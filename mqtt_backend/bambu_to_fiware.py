import json
import threading
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ORION_BASE_URL = "http://172.16.101.172:1026/ngsi-ld/v1"
PRINTERS_FILE = Path("/home/fieldlab/Desktop/bambu-fiware/printers.json")

FIWARE_SERVICE = "openiot"
FIWARE_SERVICEPATH = "/"

NGSI_CONTEXT = "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"

_file_lock = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def printer_entity_id(printer_name: str) -> str:
    safe_name = printer_name.strip().replace(" ", "_")
    return f"urn:ngsi-ld:Printer:{safe_name}"


def headers(content_type="application/ld+json"):
    return {
        "Content-Type": content_type,
        "Accept": "application/ld+json",
        "fiware-service": FIWARE_SERVICE,
        "fiware-servicepath": FIWARE_SERVICEPATH,
    }


def make_property(value, observed_at=None):
    prop = {
        "type": "Property",
        "value": value,
    }

    if observed_at:
        prop["observedAt"] = observed_at

    return prop


def normalize_number(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_int(value, default=0):
    try:
        if value is None:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_string(value, default="Unknown"):
    if value is None:
        return default

    text = str(value).strip()
    return text if text else default


def build_attrs(
    printer_name,
    progress,
    remaining_time_minutes,
    status,
    job_name,
    nozzle_temp,
    bed_temp,
    material,
    color,
    include_name=True,
):
    observed_at = now_iso()

    attrs = {
        "progress": make_property(normalize_int(progress), observed_at),
        "remainingTimeMinutes": make_property(
            normalize_int(remaining_time_minutes),
            observed_at,
        ),
        "status": make_property(normalize_string(status), observed_at),
        "jobName": make_property(normalize_string(job_name, "-"), observed_at),
        "nozzleTemp": make_property(normalize_number(nozzle_temp), observed_at),
        "bedTemp": make_property(normalize_number(bed_temp), observed_at),
        "material": make_property(normalize_string(material), observed_at),
        "color": make_property(normalize_string(color), observed_at),
        "online": make_property(True, observed_at),
        "lastSeen": make_property(observed_at, observed_at),
        "@context": [NGSI_CONTEXT],
    }

    if include_name:
        attrs["name"] = make_property(printer_name, observed_at)

    return attrs


def build_entity(
    printer_name,
    progress,
    remaining_time_minutes,
    status,
    job_name,
    nozzle_temp,
    bed_temp,
    material,
    color,
):
    entity_id = printer_entity_id(printer_name)

    attrs = build_attrs(
        printer_name,
        progress,
        remaining_time_minutes,
        status,
        job_name,
        nozzle_temp,
        bed_temp,
        material,
        color,
        include_name=True,
    )

    return {
        "id": entity_id,
        "type": "Printer",
        **attrs,
    }


def http_request(method, url, payload=None):
    data = None

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url=url,
        data=data,
        method=method,
        headers=headers(),
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, body

    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return error.code, body

    except Exception as error:
        return 0, str(error)


def is_partial_fiware_success(body):
    try:
        parsed = json.loads(body)
    except Exception:
        return '"lastSeen"' in body

    updated = parsed.get("updated", [])
    if not isinstance(updated, list):
        return False

    return "lastSeen" in updated


def create_printer_entity(
    printer_name,
    progress,
    remaining_time_minutes,
    status,
    job_name,
    nozzle_temp,
    bed_temp,
    material,
    color,
):
    entity = build_entity(
        printer_name,
        progress,
        remaining_time_minutes,
        status,
        job_name,
        nozzle_temp,
        bed_temp,
        material,
        color,
    )

    url = f"{ORION_BASE_URL}/entities"
    status_code, body = http_request("POST", url, entity)

    if status_code in (200, 201, 204):
        print(f"[FIWARE] Created {printer_name}")
        return True

    if status_code == 409:
        print(f"[FIWARE] Entity already exists for {printer_name}; retrying update")
        return False

    print(f"[FIWARE] Create failed for {printer_name}: {status_code} {body}")
    return False


def patch_printer_entity(
    printer_name,
    progress,
    remaining_time_minutes,
    status,
    job_name,
    nozzle_temp,
    bed_temp,
    material,
    color,
):
    entity_id = printer_entity_id(printer_name)
    encoded_id = urllib.parse.quote(entity_id, safe="")

    attrs = build_attrs(
        printer_name,
        progress,
        remaining_time_minutes,
        status,
        job_name,
        nozzle_temp,
        bed_temp,
        material,
        color,
        include_name=False,
    )

    url = f"{ORION_BASE_URL}/entities/{encoded_id}/attrs"
    status_code, body = http_request("PATCH", url, attrs)

    if status_code in (200, 201, 204):
        print(f"[FIWARE] Updated {printer_name}")
        return True

    if status_code == 207 and is_partial_fiware_success(body):
        print(f"[FIWARE] Updated {printer_name} with partial FIWARE response")
        return True

    if status_code == 404:
        print(f"[FIWARE] Entity missing for {printer_name}; creating it now")
        created = create_printer_entity(
            printer_name,
            progress,
            remaining_time_minutes,
            status,
            job_name,
            nozzle_temp,
            bed_temp,
            material,
            color,
        )

        if created:
            return True

        retry_status_code, retry_body = http_request("PATCH", url, attrs)

        if retry_status_code in (200, 201, 204):
            print(f"[FIWARE] Updated {printer_name} after create retry")
            return True

        if retry_status_code == 207 and is_partial_fiware_success(retry_body):
            print(
                f"[FIWARE] Updated {printer_name} after create retry "
                f"with partial FIWARE response"
            )
            return True

        print(
            f"[FIWARE] Update retry failed for {printer_name}: "
            f"{retry_status_code} {retry_body}"
        )
        return False

    print(f"[FIWARE] Update failed for {printer_name}: {status_code} {body}")
    return False


def update_local_health(printer_name, success, message=None):
    try:
        if not PRINTERS_FILE.exists():
            return

        with _file_lock:
            with PRINTERS_FILE.open("r", encoding="utf-8") as file:
                config = json.load(file)

            changed = False
            timestamp = now_iso()

            for printer in config.get("printers", []):
                if printer.get("name") == printer_name:
                    printer["is_pipeline_healthy"] = bool(success)

                    if success:
                        printer["last_seen"] = timestamp
                        printer["health_message"] = (
                            "Fresh MQTT/FIWARE telemetry received"
                        )
                        printer["last_error"] = None
                        printer["last_error_at"] = None
                    else:
                        printer["health_message"] = (
                            message or "MQTT/FIWARE pipeline failed"
                        )
                        printer["last_error"] = (
                            message or "MQTT/FIWARE pipeline failed"
                        )
                        printer["last_error_at"] = timestamp

                    changed = True
                    break

            if not changed:
                return

            tmp_path = PRINTERS_FILE.with_suffix(".json.tmp")

            with tmp_path.open("w", encoding="utf-8") as file:
                json.dump(config, file, indent=2)

            tmp_path.replace(PRINTERS_FILE)

    except Exception as error:
        print(f"[LOCAL CONFIG] Failed to update health for {printer_name}: {error}")


def update_printer(
    printer_name,
    progress,
    remaining_time_minutes,
    status,
    job_name,
    nozzle_temp,
    bed_temp,
    material,
    color,
):
    success = patch_printer_entity(
        printer_name,
        progress,
        remaining_time_minutes,
        status,
        job_name,
        nozzle_temp,
        bed_temp,
        material,
        color,
    )

    if success:
        update_local_health(
            printer_name,
            True,
            "Fresh MQTT/FIWARE telemetry received",
        )
    else:
        update_local_health(
            printer_name,
            False,
            "FIWARE update failed after MQTT data was received",
        )

    return success