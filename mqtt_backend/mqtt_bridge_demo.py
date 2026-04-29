import time
from printer_loader import load_printers
from bambu_to_fiware import update_printer

def simulate_printer_data(printer):
    import random
    progress = random.randint(0, 100)
    
    if progress < 20:
        status = "Idle"
    elif progress < 90:
        status = "Printing"
    else:
        status = "Finished"
    
    return progress, status


def main():
    print("Loading printers...")
    printers = load_printers()

    print(f"Loaded {len(printers)} printers")

    while True:
        for p in printers:
            if not p.get("enabled", True):
                continue

            name = p["name"]

            progress, status = simulate_printer_data(p)

            print(f"[{name}] Progress: {progress}% | Status: {status}")

            update_printer(name, progress, status)

        time.sleep(5)


if __name__ == "__main__":
    main()
