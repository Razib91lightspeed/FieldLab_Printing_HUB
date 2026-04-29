import time
import requests
from config import FIWARE

BASE_URL = FIWARE["orion_ld_url"]
LINK_HEADER = FIWARE["context_link"]


def _headers():
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Link": LINK_HEADER,
        "fiware-service": FIWARE["service"],
        "fiware-servicepath": FIWARE["servicepath"],
    }


def _entity_id(printer_name: str) -> str:
    safe_name = printer_name.replace(" ", "_")
    return f"urn:ngsi-ld:Printer:{safe_name}"


def _full_entity(entity_id: str):
    return {
        "id": entity_id,
        "type": "Printer",
        "progress": {"type": "Property", "value": 0},
        "status": {"type": "Property", "value": "Unknown"},
        "jobName": {"type": "Property", "value": ""},
        "nozzleTemp": {"type": "Property", "value": 0},
        "bedTemp": {"type": "Property", "value": 0},
        "material": {"type": "Property", "value": "-"},
        "color": {"type": "Property", "value": "Unknown"},
        "lastSeen": {
            "type": "Property",
            "value": time.strftime("%Y-%m-%dT%H:%M:%S")
        },
        "online": {
            "type": "Property",
            "value": True
        }
    }


def ensure_entity_exists(printer_name: str):
    entity_id = _entity_id(printer_name)
    url = f"{BASE_URL}/entities/{entity_id}"

    try:
        r = requests.get(url, headers=_headers(), timeout=5)

        if r.status_code == 200:
            return entity_id

        if r.status_code == 404:
            print(f"[FIWARE] Creating entity for {printer_name}")
            create_url = f"{BASE_URL}/entities"

            r = requests.post(
                create_url,
                headers=_headers(),
                json=_full_entity(entity_id),
                timeout=5
            )

            if r.status_code in (201, 204):
                print(f"[FIWARE] Created entity for {printer_name}")
            else:
                print(f"[FIWARE] Create failed: {r.status_code} {r.text}")

        else:
            print(f"[FIWARE] GET error: {r.status_code} {r.text}")

    except Exception as e:
        print(f"[FIWARE] ensure_entity_exists error: {e}")

    return entity_id


def delete_entity(entity_id: str):
    url = f"{BASE_URL}/entities/{entity_id}"
    try:
        requests.delete(url, headers=_headers(), timeout=5)
        print(f"[FIWARE] Deleted entity {entity_id}")
    except Exception as e:
        print(f"[FIWARE] Delete failed: {e}")


def update_printer(
    printer_name: str,
    progress: int,
    status: str,
    job_name: str,
    nozzle_temp: float,
    bed_temp: float,
    material: str,
    color: str
):
    entity_id = _entity_id(printer_name)
    url = f"{BASE_URL}/entities/{entity_id}/attrs"

    payload = {
        "progress": {"type": "Property", "value": progress},
        "status": {"type": "Property", "value": status},
        "jobName": {"type": "Property", "value": job_name},
        "nozzleTemp": {"type": "Property", "value": nozzle_temp},
        "bedTemp": {"type": "Property", "value": bed_temp},
        "material": {"type": "Property", "value": material},
        "color": {"type": "Property", "value": color},
        "lastSeen": {
            "type": "Property",
            "value": time.strftime("%Y-%m-%dT%H:%M:%S")
        },
        "online": {
            "type": "Property",
            "value": True
        }
    }

    try:
        r = requests.patch(url, headers=_headers(), json=payload, timeout=5)

        if r.status_code == 204:
            print(f"[FIWARE] Updated {printer_name}")
            return

        if r.status_code == 207:
            print(f"[FIWARE] Fixing schema for {printer_name}")

            delete_entity(entity_id)
            ensure_entity_exists(printer_name)

            r2 = requests.patch(url, headers=_headers(), json=payload, timeout=5)

            if r2.status_code == 204:
                print(f"[FIWARE] Fixed + Updated {printer_name}")
            else:
                print(f"[FIWARE] Retry failed: {r2.status_code} {r2.text}")

            return

        print(f"[FIWARE] Update failed: {r.status_code} {r.text}")

    except Exception as e:
        print(f"[FIWARE] Exception updating {printer_name}: {e}")
