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

_stop_event = threading.Event()


def now_seconds():
    return time.time()


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
    """
    Find the active filament tray from Bambu MQTT payload.

    Important:
    For AMS printers, tray_now/tray_tar are usually inside print_data["ams"],
    not directly inside print_data.

    Example:
      print.ams.tray_now = "2"
      print.ams.tray_tar = "2"

    That means active AMS tray is tray id 2.
    """

    def clean_tray_id(value):
        if value is None:
            return None

        text = str(value).strip()

        if not text:
            return None

        # Bambu uses 255 / 254 for virtual/no tray, not a real AMS tray.
        if text in ["255", "254", "-1", "unknown", "Unknown", "None", "null"]:
            return None

        return text

    ams_data = print_data.get("ams")

    # 1. Correct location for AMS printers: print.ams.tray_now / print.ams.tray_tar
    if isinstance(ams_data, dict):
        for key in ["tray_now", "tray_tar", "tray_pre"]:
            tray_id = clean_tray_id(ams_data.get(key))
            if tray_id is not None:
                return tray_id

    # 2. Fallback: sometimes Bambu may expose it directly under print
    for key in [
        "tray_now",
        "tray_tar",
        "tray_pre",
        "tray_info_idx",
        "curr_tray",
        "current_tray",
        "active_tray",
    ]:
        tray_id = clean_tray_id(print_data.get(key))
        if tray_id is not None:
            return tray_id

    # 3. Fallback: virtual tray, but ignore 255/254
    vt_tray = print_data.get("vt_tray") or print_data.get("vtTray")
    if isinstance(vt_tray, dict):
        tray_id = clean_tray_id(vt_tray.get("id"))
        if tray_id is not None:
            return tray_id

    return None


def extract_material_and_color(print_data):
    """
    MQTT-only material/color resolver.

    No hardcoded per-printer material.
    No manual material_cache.json.
    Source of truth is only the Bambu MQTT payload.

    It tries, in order:
    1. Direct print fields
    2. Virtual tray fields, often used when there is no AMS
    3. Active AMS tray if tray id is available
    4. Any valid AMS tray
    5. Recursive scan of MQTT payload for material/color-like fields
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

        for material in known_materials:
            mat_upper = material.upper().replace(" ", "")
            if upper == mat_upper or upper.startswith(mat_upper + "-"):
                return material

        # Some Bambu values can be descriptive, e.g. "Bambu PLA Basic"
        for material in known_materials:
            mat_upper = material.upper().replace(" ", "")
            if mat_upper in upper:
                return material

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

        keys = [
            "tray_type",
            "trayType",
            "filament_type",
            "filamentType",
            "filament_name",
            "filamentName",
            "material",
            "type",
        ]

        for key in keys:
            material = normalize_material(obj.get(key))
            if material:
                return material

        return None

    def color_from_object(obj):
        if not isinstance(obj, dict):
            return None

        keys = [
            "tray_color",
            "trayColor",
            "tray_rgba",
            "trayRgba",
            "filament_color",
            "filamentColor",
            "color",
        ]

        for key in keys:
            color = normalize_color(obj.get(key))
            if color:
                return color

        return None

    def scan_payload_for_material_and_color(obj):
        material_found = None
        color_found = None

        def walk(value, path=""):
            nonlocal material_found, color_found

            if material_found and color_found:
                return

            if isinstance(value, dict):
                for key, child in value.items():
                    child_path = f"{path}.{key}".lower()

                    if isinstance(child, (str, int, float)):
                        if material_found is None and any(
                            token in child_path
                            for token in [
                                "material",
                                "filament",
                                "tray_type",
                                "traytype",
                                "filament_type",
                                "filamenttype",
                            ]
                        ):
                            material = normalize_material(child)
                            if material:
                                material_found = material

                        if color_found is None and any(
                            token in child_path
                            for token in [
                                "color",
                                "rgba",
                            ]
                        ):
                            color = normalize_color(child)
                            if color:
                                color_found = color
                    else:
                        walk(child, child_path)

            elif isinstance(value, list):
                for index, child in enumerate(value):
                    walk(child, f"{path}[{index}]")

        walk(obj)
        return material_found, color_found

    material = None
    color = None

    # 1. Direct fields from print payload
    material = material_from_object(print_data)
    color = color_from_object(print_data)

    # 2. Virtual tray, common when printer is not using AMS
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

    # 3. AMS tray data
    active_tray_id = get_active_tray_id(print_data)
    trays = collect_ams_trays(print_data.get("ams"))

    selected_tray = None

    if active_tray_id:
        for tray in trays:
            if get_tray_id(tray) == active_tray_id:
                selected_tray = tray
                break

    if selected_tray:
        material = material or material_from_object(selected_tray)
        color = color or color_from_object(selected_tray)

    # 4. If no active tray id, use any tray that has valid material/color
    if (not material or not color) and trays:
        for tray in trays:
            if not isinstance(tray, dict):
                continue

            material = material or material_from_object(tray)
            color = color or color_from_object(tray)

            if material and color:
                break

    # 5. Last MQTT-only fallback: recursively scan whole print payload
    if not material or not color:
        scanned_material, scanned_color = scan_payload_for_material_and_color(print_data)
        material = material or scanned_material
        color = color or scanned_color

    final_material = material or "Unknown"
    final_color = color or "#000000"

    print(
        "[DEBUG] Active tray -> "
        f"tray_now={print_data.get('tray_now')} | "
        f"tray_tar={print_data.get('tray_tar')} | "
        f"id={active_tray_id or 'unknown'} | "
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

        fields = extract_print_fields(payload)

        payload_signature = (
            fields["progress"],
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
            f"{fields['status']} | "
            f"Job: {fields['job_name']} | "
            f"Material: {fields['material']} | "
            f"Color: {fields['color']}"
        )

        update_printer(
            self.name,
            fields["progress"],
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
