import ssl
import json
import time
import threading
import paho.mqtt.client as mqtt

from printer_loader import load_printers
from bambu_to_fiware import update_printer


def first_non_empty_string(*values):
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def parse_int_like(value):
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        value = value.strip()
        if value.isdigit():
            return int(value)
    return None


def normalize_rgba_hex(value):
    """
    Convert Bambu RGBA hex to plain UI-friendly hex.

    Examples:
      F98C36FF -> #F98C36
      161616FF -> #161616
      FFFFFF   -> #FFFFFF
    """
    if not isinstance(value, str):
        return None

    v = value.strip().lstrip("#").upper()

    if len(v) == 8:
        return f"#{v[:6]}"

    if len(v) == 6:
        return f"#{v}"

    return None


def parse_active_tray_id(ams_data: dict):
    if not isinstance(ams_data, dict):
        return None

    for key in ("tray_now", "tray_tar"):
        parsed = parse_int_like(ams_data.get(key))
        if parsed is not None:
            return parsed

    return None


def find_active_tray(print_data: dict):
    if not isinstance(print_data, dict):
        return None

    ams_data = print_data.get("ams", {})
    active_tray_id = parse_active_tray_id(ams_data)

    if active_tray_id is None:
        return None

    # AMS trays
    if active_tray_id in (0, 1, 2, 3):
        ams_units = ams_data.get("ams", [])
        if not isinstance(ams_units, list):
            return None

        for ams_unit in ams_units:
            if not isinstance(ams_unit, dict):
                continue

            trays = ams_unit.get("tray", [])
            if not isinstance(trays, list):
                continue

            for tray in trays:
                if not isinstance(tray, dict):
                    continue

                tray_id = parse_int_like(tray.get("id"))
                if tray_id == active_tray_id:
                    return tray

    # External / virtual tray
    if active_tray_id in (254, 255):
        vt_tray = print_data.get("vt_tray")
        if isinstance(vt_tray, dict):
            return vt_tray

        vir_slot = print_data.get("vir_slot")
        if (
            isinstance(vir_slot, list)
            and len(vir_slot) > 0
            and isinstance(vir_slot[0], dict)
        ):
            return vir_slot[0]

    return None


def extract_material_from_active_tray(print_data: dict):
    tray = find_active_tray(print_data)
    if not isinstance(tray, dict):
        return None

    return first_non_empty_string(
        tray.get("tray_type"),
        tray.get("filament_type"),
        tray.get("material"),
        tray.get("type"),
    )


def extract_color_from_active_tray(print_data: dict):
    tray = find_active_tray(print_data)
    if not isinstance(tray, dict):
        return None

    raw_color = first_non_empty_string(
        tray.get("tray_color"),
        tray.get("color"),
        tray.get("filament_color"),
        tray.get("rgba"),
        tray.get("tray_rgba"),
    )

    if raw_color:
        normalized = normalize_rgba_hex(raw_color)
        if normalized:
            return normalized

    cols = tray.get("cols")
    if isinstance(cols, list) and len(cols) > 0:
        normalized = normalize_rgba_hex(cols[0])
        if normalized:
            return normalized

    return None


def extract_material_non_ams(print_data: dict):
    return first_non_empty_string(
        print_data.get("material"),
        print_data.get("filament_type"),
        print_data.get("filamentType"),
        print_data.get("tray_type"),
        print_data.get("filament_name"),
        print_data.get("filament"),
    )


def extract_color_non_ams(print_data: dict):
    raw_color = first_non_empty_string(
        print_data.get("color"),
        print_data.get("filament_color"),
        print_data.get("tray_color"),
        print_data.get("filamentColor"),
    )

    normalized = normalize_rgba_hex(raw_color)
    if normalized:
        return normalized

    vt_tray = print_data.get("vt_tray")
    if isinstance(vt_tray, dict):
        vt_color = normalize_rgba_hex(vt_tray.get("tray_color"))
        if vt_color:
            return vt_color

    vir_slot = print_data.get("vir_slot")
    if isinstance(vir_slot, list) and len(vir_slot) > 0 and isinstance(vir_slot[0], dict):
        vir_color = normalize_rgba_hex(vir_slot[0].get("tray_color"))
        if vir_color:
            return vir_color

    return None


def resolve_material(print_data: dict):
    material = extract_material_from_active_tray(print_data)
    if material:
        return material

    material = extract_material_non_ams(print_data)
    if material:
        return material

    return "Unknown"


def resolve_color(print_data: dict):
    color = extract_color_from_active_tray(print_data)
    if color:
        return color

    color = extract_color_non_ams(print_data)
    if color:
        return color

    return "Unknown"


def debug_active_tray(print_data: dict):
    ams_data = print_data.get("ams", {})
    tray_now = ams_data.get("tray_now")
    tray_tar = ams_data.get("tray_tar")

    tray = find_active_tray(print_data)

    if tray:
        print(
            "[DEBUG] Active tray -> "
            f"tray_now={tray_now} | "
            f"tray_tar={tray_tar} | "
            f"id={tray.get('id')} | "
            f"type={tray.get('tray_type')} | "
            f"color={tray.get('tray_color')}"
        )
    else:
        print(
            "[DEBUG] No active tray found | "
            f"tray_now={tray_now} | "
            f"tray_tar={tray_tar}"
        )


def create_client(printer):
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)

    client.username_pw_set("bblp", printer["access_code"])
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)

    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print(f"[{printer['name']}] Connected successfully")
            topic = f"device/{printer['serial']}/report"
            client.subscribe(topic)
            print(f"[{printer['name']}] Subscribed to {topic}")
        else:
            print(f"[{printer['name']}] MQTT connect failed rc={rc}")

    def on_message(client, userdata, msg):
        try:
            data = json.loads(msg.payload.decode())
            p = data.get("print", {})

            progress = p.get("percent", 0)
            status = p.get("gcode_state", "Unknown")
            job_name = p.get("subtask_name", "None")
            nozzle_temp = p.get("nozzle_temper", 0)
            bed_temp = p.get("bed_temper", 0)

            material = resolve_material(p)
            color = resolve_color(p)

            debug_active_tray(p)

            print(
                f"[{printer['name']}] {progress}% | {status} | "
                f"Job: {job_name} | Material: {material} | Color: {color}"
            )

            update_printer(
                printer["name"],
                progress,
                status,
                job_name,
                nozzle_temp,
                bed_temp,
                material,
                color,
            )

        except Exception as e:
            print(f"[{printer['name']}] Error: {e}")

    client.on_connect = on_connect
    client.on_message = on_message

    return client


def run_printer(printer):
    while True:
        try:
            print(f"Starting connection for {printer['name']}")
            client = create_client(printer)
            client.connect(printer["ip"], 8883, 60)
            client.loop_forever()

        except Exception as e:
            print(f"[{printer['name']}] Connection failed: {e}")

        print(f"[{printer['name']}] Reconnecting in 5 seconds...")
        time.sleep(5)


def main():
    printers = load_printers()
    threads = []

    for p in printers:
        if not p.get("enabled", True):
            continue

        t = threading.Thread(target=run_printer, args=(p,), daemon=True)
        t.start()
        threads.append(t)

        time.sleep(2)

    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
