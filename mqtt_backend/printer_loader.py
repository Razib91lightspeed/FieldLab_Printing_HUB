import json

def load_printers(path="printers.json"):
    with open(path, "r") as f:
        data = json.load(f)
    return data["printers"]
