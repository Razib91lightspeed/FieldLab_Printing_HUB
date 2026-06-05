import json
import signal
import ssl
import threading
import time
from pathlib import Path

import paho.mqtt.client as mqtt

from bambu_to_fiware import update_local_health, update_printer


PRINTERS_FILE = Path("/home/fieldlab/Desktop/bambu-fiware/printers.json")
MATERIAL_CACHE_FILE = Path("/home/fieldlab/Desktop/bambu-fiware/material_cache.json")

MQTT_PORT = 8883
MQTT_USERNAME = "bblp"

MIN_FIWARE_UPDATE_INTERVAL_SECONDS = 1
CONFIG_RECHECK_SECONDS = 2
CONNECT_RETRY_SECONDS = 3

# When the user presses Stop on the printer, Bambu first sends:
#   command = "stop", reason = "SUCCESS"
# and shortly after it may report:
#   gcode_state = "FAILED"
#
# That final FAILED is not always a machine failure. If it happens shortly
# after a successful stop command, we classify it as STOPPED_BY_USER.
USER_STOP_COMMAND_MEMORY_SECONDS = 30

# Once a user stop is confirmed, later Bambu packets may continue saying
# gcode_state="FAILED". Keep showing STOPPED_BY_USER for the same job
# instead of letting later FAILED packets overwrite the dashboard.
USER_STOPPED_STATE_MEMORY_SECONDS = 30 * 60

_stop_event = threading.Event()


def now_seconds():
    return time.time()

def get_print_data(payload):
    """
    Bambu MQTT sometimes wraps printer state inside payload["print"].
    Other packets put fields directly at the root.
    """
    if isinstance(payload, dict) and isinstance(payload.get("print"), dict):
        return payload["print"]

    if isinstance(payload, dict):
        return payload

    return {}


def clean_text(value):
    return str(value or "").strip()


def get_payload_command(payload):
    """
    Command acknowledgement packets look like:
      {"command": "stop", "reason": "SUCCESS"}

    They are not full printer telemetry and usually do not contain gcode_state.
    """
    print_data = get_print_data(payload)

    return clean_text(
        print_data.get("command") or payload.get("command")
    ).lower()


def get_payload_reason(payload):
    print_data = get_print_data(payload)

    return clean_text(
        print_data.get("reason") or payload.get("reason")
    ).upper()


def is_success_reason(reason):
    return clean_text(reason).upper() in ["SUCCESS", "OK", "0"]


def payload_has_real_printer_state(payload):
    """
    True only when the payload contains a real printer status field.

    We intentionally do not treat the numeric "state" field alone as enough,
    because command-only acknowledgements can otherwise become UNKNOWN/idle-like
    updates and overwrite the useful previous FIWARE state.
    """
    print_data = get_print_data(payload)

    real_status_keys = [
        "gcode_state",
        "status",
        "print_status",
        "printStatus",
    ]

    for key in real_status_keys:
        value = clean_text(print_data.get(key))

        if value:
            return True

    return False


def is_command_only_payload(payload):
    """
    Command-only packets should be observed for control context,
    but they should not be sent to FIWARE as printer telemetry.

    Examples:
      command=stop, reason=SUCCESS
      command=pause, reason=SUCCESS
      command=resume, reason=SUCCESS
      command=gcode_line, reason=SUCCESS
    """
    command = get_payload_command(payload)

    return bool(command) and not payload_has_real_printer_state(payload)


def is_recent_user_stop(last_user_stop_at):
    if not last_user_stop_at:
        return False

    return now_seconds() - last_user_stop_at <= USER_STOP_COMMAND_MEMORY_SECONDS


def read_config():
    with PRINTERS_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_enabled_printers():
    try:
        config = read_config()
    except Exception as error:
        print(f"[CONFIG] Failed to read {PRINTERS_FILE}: {error}")
        return []

    printers = []

    for printer in config.get("printers", []):
        if not printer.get("enabled", True):
            continue

        name = str(printer.get("name", "")).strip()
        ip = str(printer.get("ip", "")).strip()
        access_code = str(printer.get("access_code", "")).strip()
        serial = str(printer.get("serial", "")).strip()

        if not name or not ip or not access_code or not serial:
            print(f"[CONFIG] Skipping incomplete printer config: {printer}")
            continue

        printers.append(
            {
                "id": str(printer.get("id", "")).strip(),
                "name": name,
                "ip": ip,
                "access_code": access_code,
                "serial": serial,
                "enabled": True,
            }
        )

    return printers




def load_material_cache():
    try:
        if not MATERIAL_CACHE_FILE.exists():
            return {}
        with MATERIAL_CACHE_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as error:
        print(f"[CACHE] Failed to read material cache: {error}")
        return {}


def save_material_cache(cache):
    try:
        tmp_path = MATERIAL_CACHE_FILE.with_suffix(".json.tmp")
        with tmp_path.open("w", encoding="utf-8") as file:
            json.dump(cache, file, indent=2)
        tmp_path.replace(MATERIAL_CACHE_FILE)
    except Exception as error:
        print(f"[CACHE] Failed to save material cache: {error}")


def is_known_material(value):
    text = str(value or "").strip().lower()
    return bool(text) and text not in ["unknown", "-", "none", "null"]


def is_known_color(value):
    text = str(value or "").strip().upper()
    return bool(text) and text not in ["#000000", "000000", "00000000", "-", "UNKNOWN", "NONE", "NULL"]


def resolve_material_with_cache(printer_name, material, color):
    cache = load_material_cache()
    cached = cache.get(printer_name, {})

    final_material = material
    final_color = color

    if is_known_material(material):
        cached["material"] = material
    elif is_known_material(cached.get("material")):
        final_material = cached["material"]

    if is_known_color(color):
        cached["color"] = color
    elif is_known_color(cached.get("color")):
        final_color = cached["color"]

    cache[printer_name] = cached
    save_material_cache(cache)

    return final_material, final_color


def printer_signature(printer):
    return (
        printer.get("id"),
        printer.get("name"),
        printer.get("ip"),
        printer.get("access_code"),
        printer.get("serial"),
        printer.get("enabled"),
    )



def is_real_material_value(value):
    text = str(value or "").strip().lower()
    return bool(text) and text not in ["unknown", "-", "none", "null", ""]


def is_real_color_value(value):
    text = str(value or "").strip().upper()
    return bool(text) and text not in [
        "#000000",
        "000000",
        "00000000",
        "-",
        "UNKNOWN",
        "NONE",
        "NULL",
        "",
    ]


def get_reason_code_value(reason_code):
    try:
        return int(reason_code)
    except Exception:
        pass

    value = getattr(reason_code, "value", None)
    if value is not None:
        try:
            return int(value)
        except Exception:
            pass

    return reason_code


def mqtt_error_message(rc):
    if rc == 0:
        return "Connection accepted"
    if rc == 1:
        return "MQTT connect failed rc=1. Unacceptable protocol version."
    if rc == 2:
        return "MQTT connect failed rc=2. Identifier rejected."
    if rc == 3:
        return "MQTT connect failed rc=3. Server unavailable."
    if rc == 4:
        return "MQTT connect failed rc=4. Bad username or password."
    if rc == 5:
        return (
            "MQTT connect failed rc=5. Not authorized. "
            "Access code is probably wrong or LAN access is disabled."
        )

    return f"MQTT connect failed rc={rc}."


def normalize_int(value, default=0):
    try:
        if value is None:
            return default
        return int(float(value))
    except Exception:
        return default


def normalize_float(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def normalize_text(value, default="Unknown"):
    if value is None:
        return default

    text = str(value).strip()
    return text if text else default


def first_existing(data, keys, default=None):
    for key in keys:
        if key in data and data.get(key) is not None:
            return data.get(key)
    return default


def clean_color(value):
    if value is None:
        return "#000000"

    text = str(value).strip()

    if not text:
        return "#000000"

    if text.startswith("#"):
        text = text[1:]

    text = text.upper()

    if len(text) >= 6:
        return f"#{text[:6]}"

    return "#000000"


def collect_ams_trays(ams_data):
    trays = []

    if not ams_data:
        return trays

    if isinstance(ams_data, dict):
        possible_lists = []

        if isinstance(ams_data.get("tray"), list):
            possible_lists.append(ams_data.get("tray"))

        if isinstance(ams_data.get("ams"), list):
            possible_lists.append(ams_data.get("ams"))

        for maybe_list in possible_lists:
            for item in maybe_list:
                if isinstance(item, dict):
                    if isinstance(item.get("tray"), list):
                        trays.extend(item.get("tray"))
                    else:
                        trays.append(item)

    if isinstance(ams_data, list):
        for item in ams_data:
            if not isinstance(item, dict):
                continue

            if isinstance(item.get("tray"), list):
                trays.extend(item.get("tray"))
            else:
                trays.append(item)

    return [tray for tray in trays if isinstance(tray, dict)]


def get_tray_id(tray):
    return str(
        first_existing(
            tray,
            [
                "id",
                "tray_id",
                "tray_idx",
                "index",
                "slot",
            ],
            "",
        )
    ).strip()


def get_active_tray_id(print_data):
    tray_now = first_existing(print_data, ["tray_now", "trayNow"])
    tray_tar = first_existing(print_data, ["tray_tar", "trayTar", "tray_target"])

    for value in [tray_now, tray_tar]:
        if value is None:
            continue

        text = str(value).strip()

        if text and text not in ["-1", "254", "255"]:
            return text

    for value in [tray_now, tray_tar]:
        if value is None:
            continue

        text = str(value).strip()

        if text:
            return text

    return ""


def extract_material_and_color(print_data):
    """
    Correct AMS material/color resolver.

    Production rule:
    - For AMS printers, ams.tray_now / ams.tray_tar is the source of truth.
    - tray_now is treated as AMS tray index/id.
    - Do not guess tray 0 when active tray exists.
    - Do not use hardcoded cache.
    """

    known_materials = [
        "PLA",
        "PLA+",
        "PETG",
        "ABS",
        "ASA",
        "TPU",
        "PA",
        "PC",
        "PVA",
        "BVOH",
        "HIPS",
        "NYLON",
        "SUPPORT",
    ]

    def normalize_material(value):
        if value is None:
            return None

        text = str(value).strip()
        if not text:
            return None

        upper = text.upper().replace(" ", "")

        if upper in ["UNKNOWN", "NONE", "NULL", "-", ""]:
            return None

        for material_name in known_materials:
            mat_upper = material_name.upper().replace(" ", "")
            if upper == mat_upper or upper.startswith(mat_upper + "-"):
                return material_name

        for material_name in known_materials:
            mat_upper = material_name.upper().replace(" ", "")
            if mat_upper in upper:
                return material_name

        return None

    def normalize_color(value):
        if value is None:
            return None

        text = str(value).strip()
        if not text:
            return None

        if text.startswith("#"):
            text = text[1:]

        text = text.upper()

        if text in ["UNKNOWN", "NONE", "NULL", "-", "000000", "00000000"]:
            return None

        if len(text) >= 6:
            return f"#{text[:6]}"

        return None

    def material_from_object(obj):
        if not isinstance(obj, dict):
            return None

        for key in [
            "tray_type",
            "trayType",
            "filament_type",
            "filamentType",
            "filament_name",
            "filamentName",
            "tray_name",
            "trayName",
            "material",
            "type",
        ]:
            material = normalize_material(obj.get(key))
            if material:
                return material

        return None

    def color_from_object(obj):
        if not isinstance(obj, dict):
            return None

        for key in [
            "tray_color",
            "trayColor",
            "tray_rgba",
            "trayRgba",
            "filament_color",
            "filamentColor",
            "color",
            "colour",
        ]:
            color = normalize_color(obj.get(key))
            if color:
                return color

        return None

    def clean_active_tray(value):
        if value is None:
            return None

        text = str(value).strip()

        if not text:
            return None

        # 254/255 are Bambu virtual/no-tray values, not real AMS tray indexes.
        if text in ["254", "255", "-1", "unknown", "Unknown", "None", "null"]:
            return None

        return text

    def get_ams_active_tray_raw():
        ams_data = print_data.get("ams")

        if isinstance(ams_data, dict):
            for key in ["tray_now", "tray_tar", "tray_pre", "active_tray"]:
                active = clean_active_tray(ams_data.get(key))
                if active is not None:
                    return active

        for key in ["tray_now", "tray_tar", "tray_pre", "active_tray"]:
            active = clean_active_tray(print_data.get(key))
            if active is not None:
                return active

        return None

    def select_active_ams_tray(trays, active_raw):
        if not trays or active_raw is None:
            return None

        active_text = str(active_raw).strip()

        # First try matching by real tray id field.
        for tray in trays:
            if str(get_tray_id(tray)).strip() == active_text:
                return tray

        # Then treat active tray as list index.
        try:
            index = int(active_text)
            if 0 <= index < len(trays):
                return trays[index]
        except Exception:
            pass

        return None

    ams_data = print_data.get("ams")
    trays = collect_ams_trays(ams_data)
    active_raw = get_ams_active_tray_raw()
    selected_tray = select_active_ams_tray(trays, active_raw)

    # AMS case: active tray is source of truth.
    if selected_tray:
        material = material_from_object(selected_tray) or "Unknown"
        color = color_from_object(selected_tray) or "#000000"

        print(
            "[DEBUG] ACTIVE AMS selected -> "
            f"active={active_raw} | "
            f"tray_count={len(trays)} | "
            f"tray_id={get_tray_id(selected_tray)} | "
            f"type={material} | "
            f"color={color.replace('#', '')}"
        )

        return material, color

    # If AMS exists but active tray was not selectable, do not guess tray 0.
    if trays:
        print(
            "[DEBUG] AMS present but active tray not selectable -> "
            f"active={active_raw or 'unknown'} | "
            f"tray_count={len(trays)} | "
            "type=Unknown | color=000000"
        )

        return "Unknown", "#000000"

    # Non-AMS fallback: direct/virtual tray fields.
    material = material_from_object(print_data)
    color = color_from_object(print_data)

    vt_tray = (
        print_data.get("vt_tray")
        or print_data.get("vtTray")
        or print_data.get("virtual_tray")
        or print_data.get("virtualTray")
    )

    if isinstance(vt_tray, dict):
        material = material or material_from_object(vt_tray)
        color = color or color_from_object(vt_tray)

    elif isinstance(vt_tray, list):
        for tray in vt_tray:
            if not isinstance(tray, dict):
                continue

            material = material or material_from_object(tray)
            color = color or color_from_object(tray)

            if material and color:
                break

    final_material = material or "Unknown"
    final_color = color or "#000000"

    print(
        "[DEBUG] Non-AMS material -> "
        f"type={final_material} | "
        f"color={final_color.replace('#', '')}"
    )

    return final_material, final_color


def extract_print_fields(payload):
    print_data = payload.get("print", payload)

    if not isinstance(print_data, dict):
        print_data = {}

    progress = normalize_int(
        first_existing(
            print_data,
            [
                "mc_percent",
                "progress",
                "print_percent",
                "printPercentage",
                "percent",
            ],
            0,
        )
    )
    remaining_time_minutes = normalize_int(
        first_existing(
            print_data,
            [
                "mc_remaining_time",
                "remain_time",
                "remaining_time",
                "time_remaining",
            ],
            0,
        )
    )

    status = normalize_text(
        first_existing(
            print_data,
            [
                "gcode_state",
                "status",
                "state",
                "print_status",
                "printStatus",
            ],
            "UNKNOWN",
        ),
        default="UNKNOWN",
    )

    job_name = normalize_text(
        first_existing(
            print_data,
            [
                "subtask_name",
                "subtaskName",
                "gcode_file",
                "gcodeFile",
                "project_name",
                "projectName",
                "job_name",
                "jobName",
                "file",
            ],
            "-",
        ),
        default="-",
    )

    nozzle_temp = normalize_float(
        first_existing(
            print_data,
            [
                "nozzle_temper",
                "nozzleTemp",
                "nozzle_temp",
                " nozzle_temper",
            ],
            0,
        )
    )

    bed_temp = normalize_float(
        first_existing(
            print_data,
            [
                "bed_temper",
                "bedTemp",
                "bed_temp",
            ],
            0,
        )
    )

    material, color = extract_material_and_color(print_data)

    return {
        "progress": progress,
        "remaining_time_minutes": remaining_time_minutes,
        "status": status,
        "job_name": job_name,
        "nozzle_temp": nozzle_temp,
        "bed_temp": bed_temp,
        "material": material,
        "color": color,
    }


class PrinterMqttWorker:
    def __init__(self, printer):
        self.printer = printer
        self.name = printer["name"]
        self.ip = printer["ip"]
        self.access_code = printer["access_code"]
        self.serial = printer["serial"]
        self.topic = f"device/{self.serial}/report"

        self.connected = False
        self.last_fiware_update = 0
        self.last_payload_signature = None

        # Remembers the moment when Bambu confirms command="stop".
        # If a FAILED state arrives soon after, we classify it as
        # STOPPED_BY_USER instead of machine failure.
        self.last_user_stop_at = 0

        # Persistent classification memory:
        # After command="stop" SUCCESS, the first FAILED is converted to
        # STOPPED_BY_USER. Bambu may continue sending FAILED afterwards.
        # These fields prevent later FAILED packets for the same job from
        # overwriting STOPPED_BY_USER.
        self.user_stopped_job_name = None
        self.user_stopped_until = 0

        # Sticky user-stop state:
        # Once a job is classified as STOPPED_BY_USER, keep that status for
        # later FAILED packets of the same job. Clear only when a real new
        # active state/job starts.
        self.user_stop_active = False

        self.last_good_material = None
        self.last_good_color = None
        self.last_known_material = None
        self.last_known_color = None
        self.client = None

    def build_client(self):
        client_id = f"fieldlab-{self.name.replace(' ', '-')}-{int(time.time())}"

        client = mqtt.Client(client_id=client_id)
        client.username_pw_set(MQTT_USERNAME, self.access_code)
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)

        client.on_connect = self.on_connect
        client.on_disconnect = self.on_disconnect
        client.on_message = self.on_message

        return client

    def on_connect(self, client, userdata, flags, reason_code, *extra):
        rc = get_reason_code_value(reason_code)

        if rc == 0:
            self.connected = True
            print(f"[{self.name}] MQTT connected")
            update_local_health(
                self.name,
                False,
                "MQTT connected. Waiting for first telemetry payload.",
            )
            client.subscribe(self.topic)
            print(f"[{self.name}] Subscribed to {self.topic}")
            return

        self.connected = False
        message = mqtt_error_message(rc)
        print(f"[{self.name}] MQTT connect failed rc={rc}")
        update_local_health(self.name, False, message)

    def on_disconnect(self, client, userdata, reason_code, *extra):
        rc = get_reason_code_value(reason_code)
        self.connected = False

        if rc == 0:
            print(f"[{self.name}] MQTT disconnected cleanly")
            return

        message = f"MQTT disconnected unexpectedly rc={rc}"
        print(f"[{self.name}] {message}")
        update_local_health(self.name, False, message)

    def on_message(self, client, userdata, message):
        try:
            payload_text = message.payload.decode("utf-8", errors="replace")
            payload = json.loads(payload_text)
        except Exception as error:
            error_message = f"Invalid MQTT payload: {error}"
            print(f"[{self.name}] {error_message}")
            update_local_health(self.name, False, error_message)
            return

        # ------------------------------------------------------------
        # Command acknowledgement handling
        # ------------------------------------------------------------
        # Bambu sends command-only packets such as:
        #   command="stop", reason="SUCCESS"
        # These packets are useful context, but they are not full telemetry.
        # Do not let them overwrite FIWARE with UNKNOWN.
        command_name = get_payload_command(payload)
        command_reason = get_payload_reason(payload)

        if command_name == "stop" and is_success_reason(command_reason):
            self.last_user_stop_at = now_seconds()
            print(
                f"[{self.name}] User stop command confirmed by printer; "
                "waiting for final printer state"
            )

        if is_command_only_payload(payload):
            print(
                f"[{self.name}] Ignoring command-only MQTT packet "
                f"command={command_name!r} reason={command_reason!r}; "
                "not updating FIWARE"
            )
            return

        fields = extract_print_fields(payload)

        # ------------------------------------------------------------
        # User-stop classification
        # ------------------------------------------------------------
        # After a physical/user Stop, Bambu may report gcode_state=FAILED.
        # If that FAILED arrives soon after command=stop SUCCESS, classify it
        # as STOPPED_BY_USER so the dashboard does not show a false machine
        # failure.
        # ------------------------------------------------------------
        # Persistent user-stop classification
        # ------------------------------------------------------------
        # Bambu reports a user stop as:
        #   command="stop", reason="SUCCESS"
        # followed by:
        #   gcode_state="FAILED"
        #
        # Important:
        # After that, Bambu may continue sending FAILED packets for the same
        # job. Those later packets must NOT overwrite STOPPED_BY_USER.
        #
        # Long-term state-machine rule:
        # - First FAILED after confirmed stop command => STOPPED_BY_USER
        # - Later FAILED for same job while user_stop_active => STOPPED_BY_USER
        # - Clear user_stop_active only when a real new active/clean state starts.
        status_upper = str(fields.get("status") or "").upper()
        job_name = str(fields.get("job_name") or "")

        stopped_by_recent_command = (
            status_upper == "FAILED"
            and is_recent_user_stop(self.last_user_stop_at)
        )

        stopped_by_existing_memory = (
            status_upper == "FAILED"
            and self.user_stop_active
            and self.user_stopped_job_name
            and self.user_stopped_job_name == job_name
        )

        if stopped_by_recent_command or stopped_by_existing_memory:
            if stopped_by_recent_command:
                self.user_stop_active = True
                self.user_stopped_job_name = job_name
                self.user_stopped_until = 0
                self.last_user_stop_at = 0

                print(
                    f"[{self.name}] Reclassifying FAILED as STOPPED_BY_USER "
                    "because a recent user stop command was confirmed"
                )
            else:
                print(
                    f"[{self.name}] Keeping STOPPED_BY_USER for same stopped job "
                    f"{job_name!r}"
                )

            fields["status"] = "STOPPED_BY_USER"

        elif status_upper in ["RUNNING", "PRINTING", "PAUSE", "PAUSED", "FINISH", "FINISHED"]:
            # Clear old stopped-by-user memory only when the printer enters a
            # real non-failed state and we are not inside the immediate stop
            # transition window.
            if not is_recent_user_stop(self.last_user_stop_at):
                if self.user_stop_active:
                    print(
                        f"[{self.name}] Clearing STOPPED_BY_USER memory because "
                        f"printer entered {status_upper}"
                    )

                self.user_stop_active = False
                self.user_stopped_job_name = None
                self.user_stopped_until = 0

        # AMS MEMORY SAFETY:
        # Some Bambu packets are partial. If a later packet lacks material/color,
        # keep the last real MQTT-derived material/color instead of overwriting FIWARE
        # with Unknown/#000000.
        if is_real_material_value(fields.get("material")):
            self.last_good_material = fields["material"]
        elif self.last_good_material:
            print(
                f"[AMS MEMORY] {self.name}: keeping material "
                f"{self.last_good_material}"
            )
            fields["material"] = self.last_good_material

        if is_real_color_value(fields.get("color")):
            self.last_good_color = fields["color"]
        elif self.last_good_color:
            print(
                f"[AMS MEMORY] {self.name}: keeping color "
                f"{self.last_good_color}"
            )
            fields["color"] = self.last_good_color


        # Some Bambu MQTT packets are partial and may omit active AMS tray info.
        # If that happens, do not overwrite the correct active tray color with tray 0.
        # Keep the last material/color that was actually derived from MQTT.
        if is_known_material(fields.get("material")):
            self.last_known_material = fields["material"]
        elif self.last_known_material:
            print(
                f"[MQTT MEMORY] {self.name}: keeping last material "
                f"{self.last_known_material}"
            )
            fields["material"] = self.last_known_material

        if is_known_color(fields.get("color")):
            self.last_known_color = fields["color"]
        elif self.last_known_color:
            print(
                f"[MQTT MEMORY] {self.name}: keeping last color "
                f"{self.last_known_color}"
            )
            fields["color"] = self.last_known_color

        payload_signature = (
            fields["progress"],
            fields["remaining_time_minutes"],
            fields["status"],
            fields["job_name"],
            fields["nozzle_temp"],
            fields["bed_temp"],
            fields["material"],
            fields["color"],
        )

        now = now_seconds()
        enough_time_passed = (
            now - self.last_fiware_update >= MIN_FIWARE_UPDATE_INTERVAL_SECONDS
        )
        payload_changed = payload_signature != self.last_payload_signature

        if not enough_time_passed and not payload_changed:
            return

        self.last_fiware_update = now
        self.last_payload_signature = payload_signature

        print(
            f"[{self.name}] "
            f"{fields['progress']}% | "
 	    f"{fields['remaining_time_minutes']} min left | "
            f"{fields['status']} | "
            f"Job: {fields['job_name']} | "
            f"Material: {fields['material']} | "
            f"Color: {fields['color']}"
        )

        update_printer(
            self.name,
            fields["progress"],
	    fields["remaining_time_minutes"],
            fields["status"],
            fields["job_name"],
            fields["nozzle_temp"],
            fields["bed_temp"],
            fields["material"],
            fields["color"],
        )

    def run_once(self):
        self.client = self.build_client()

        print(f"Starting connection for {self.name}")

        try:
            self.client.connect(self.ip, MQTT_PORT, keepalive=60)
            self.client.loop_start()

            while not _stop_event.is_set():
                time.sleep(1)

        except Exception as error:
            message = (
                f"MQTT connection exception for {self.name}: {error}. "
                "Check IP address, printer network, and access code."
            )
            print(f"[{self.name}] {message}")
            update_local_health(self.name, False, message)

        finally:
            try:
                if self.client:
                    self.client.loop_stop()
                    self.client.disconnect()
            except Exception:
                pass

    def run_forever(self):
        while not _stop_event.is_set():
            self.run_once()

            if _stop_event.is_set():
                break

            time.sleep(CONNECT_RETRY_SECONDS)


def signal_handler(signum, frame):
    print(f"[SYSTEM] Received signal {signum}. Stopping bridge...")
    _stop_event.set()


def start_workers():
    printers = load_enabled_printers()

    if not printers:
        print("[SYSTEM] No enabled printers found in printers.json")
        return []

    threads = []

    for printer in printers:
        worker = PrinterMqttWorker(printer)

        thread = threading.Thread(
            target=worker.run_forever,
            name=f"mqtt-{printer['id'] or printer['name']}",
            daemon=True,
        )

        thread.start()
        threads.append(thread)

        time.sleep(1)

    return threads


def main():
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    print("[SYSTEM] Starting Bambu MQTT to FIWARE bridge")
    print(f"[SYSTEM] Using config: {PRINTERS_FILE}")

    threads = start_workers()

    try:
        while not _stop_event.is_set():
            time.sleep(CONFIG_RECHECK_SECONDS)

            alive_count = sum(1 for thread in threads if thread.is_alive())

            if alive_count == 0:
                print("[SYSTEM] All worker threads stopped. Restarting workers...")
                threads = start_workers()

    finally:
        _stop_event.set()

        for thread in threads:
            thread.join(timeout=5)

        print("[SYSTEM] Bridge stopped")


if __name__ == "__main__":
    main()