import json
import re
import sys
import urllib.request
from datetime import datetime, timezone

API_BASE = "http://10.10.1.54:4000"
HEALTHY_MAX_AGE_MINUTES = 3

def fetch(path):
    url = API_BASE + path
    with urllib.request.urlopen(url, timeout=8) as res:
        return json.loads(res.read().decode("utf-8"))

def read_value(value):
    if isinstance(value, dict) and "value" in value:
        return value["value"]
    return value

def normalize_key(value):
    text = str(value or "").lower()
    text = text.replace("urn:ngsi-ld:printer:", "")
    text = text.replace("urn:ngsi-ld:", "")
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text

def canonical_bambu_key(value):
    normalized = normalize_key(value)

    if not normalized:
        return ""

    m = re.search(r"bambu\s*a\s*(\d+)", normalized)
    if m:
        return f"bambu a{m.group(1)}"

    m = re.match(r"^p(\d+)$", normalized)
    if m:
        return f"bambu a{m.group(1)}"

    m = re.match(r"^a\s*(\d+)$", normalized)
    if m:
        return f"bambu a{m.group(1)}"

    return normalized

def unique_keys(values):
    keys = set()

    for value in values:
        if not value:
            continue

        normalized = normalize_key(value)
        canonical = canonical_bambu_key(value)

        if normalized:
            keys.add(normalized)
        if canonical:
            keys.add(canonical)

    return sorted(keys)

def normalize_fiware_printer_name(entity_id):
    tail = str(entity_id or "").split(":")[-1]
    return tail.replace("_", " ")

def parse_timestamp(value):
    if not value:
        return None

    raw = str(value).strip()
    raw = re.sub(r"\.(\d{3})\d+(Z|[+-]\d{2}:?\d{2})$", r".\1\2", raw)

    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(raw)
    except Exception:
        pass

    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$", raw)
    if m:
        d, mo, y, h, mi, s = m.groups()
        return datetime(int(y), int(mo), int(d), int(h), int(mi), int(s or 0))

    return None

def minutes_since(value):
    dt = parse_timestamp(value)
    if not dt:
        return None

    if dt.tzinfo is None:
        now = datetime.now()
    else:
        now = datetime.now(timezone.utc)

    return max(0, (now - dt).total_seconds() / 60)

def extract_live_printers(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["printers", "entities", "data"]:
            if isinstance(data.get(key), list):
                return data[key]
        if data.get("id"):
            return [data]
    return []

def build_live_map(live_entities):
    live_map = {}

    for entity in live_entities:
        entity_id = entity.get("id", "")
        normalized_name = normalize_fiware_printer_name(entity_id)
        fiware_name = read_value(entity.get("name")) or normalized_name
        last_seen = read_value(entity.get("lastSeen")) or read_value(entity.get("last_seen"))
        online = read_value(entity.get("online"))
        status = read_value(entity.get("status"))

        live_state = {
            "id": entity_id,
            "name": fiware_name,
            "status": status,
            "online": online,
            "lastSeen": last_seen,
        }

        keys = unique_keys([
            entity_id,
            normalized_name,
            fiware_name,
            canonical_bambu_key(entity_id),
            canonical_bambu_key(normalized_name),
            canonical_bambu_key(fiware_name),
        ])

        for key in keys:
            live_map[key] = live_state

    return live_map

def get_live_for_printer(printer, live_map):
    keys = unique_keys([
        printer.get("id"),
        printer.get("name"),
        printer.get("serial"),
        canonical_bambu_key(printer.get("id")),
        canonical_bambu_key(printer.get("name")),
        canonical_bambu_key(printer.get("serial")),
    ])

    for key in keys:
        if key in live_map:
            return live_map[key], keys

    return None, keys

def main():
    print(f"API_BASE = {API_BASE}")
    print()

    config = fetch("/api/printer-config")
    live_data = fetch("/api/printers")

    printers = config.get("printers", [])
    live_entities = extract_live_printers(live_data)
    live_map = build_live_map(live_entities)

    print("LOCAL CONFIG PRINTERS:")
    for p in printers:
        print(f"- id={p.get('id')} | name={p.get('name')} | serial={p.get('serial')} | enabled={p.get('enabled')} | last_seen={p.get('last_seen')}")
    print()

    print("FIWARE LIVE ENTITIES FROM BACKEND /api/printers:")
    for e in live_entities:
        entity_id = e.get("id")
        name = read_value(e.get("name"))
        status = read_value(e.get("status"))
        online = read_value(e.get("online"))
        last_seen = read_value(e.get("lastSeen")) or read_value(e.get("last_seen"))
        age = minutes_since(last_seen)
        age_text = "unknown" if age is None else f"{age:.2f} min"
        print(f"- id={entity_id} | name={name} | status={status} | online={online} | lastSeen={last_seen} | age={age_text}")
    print()

    print("LIVE MAP KEYS:")
    for key in sorted(live_map.keys()):
        print(f"- {key} -> {live_map[key]['id']}")
    print()

    print("MATCH + HEALTH RESULT:")
    healthy_count = 0

    for p in printers:
        live, tried_keys = get_live_for_printer(p, live_map)

        if not p.get("enabled", True):
            result = "DISABLED"
        elif not live:
            result = "NO MATCH"
        else:
            age = minutes_since(live.get("lastSeen"))
            if age is None:
                result = "NO VALID TIMESTAMP"
            elif age > HEALTHY_MAX_AGE_MINUTES:
                result = f"STALE ({age:.2f} min old)"
            elif live.get("online") is False:
                result = "OFFLINE"
            else:
                result = "HEALTHY"
                healthy_count += 1

        print()
        print(f"{p.get('name')} ({p.get('id')})")
        print(f"  tried keys: {tried_keys}")
        print(f"  matched live: {live}")
        print(f"  result: {result}")

    print()
    print(f"HEALTHY COUNT = {healthy_count}/{len(printers)}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("DEBUG SCRIPT FAILED:", repr(e))
        sys.exit(1)
