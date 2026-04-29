import ssl
import json
import threading
import time
import paho.mqtt.client as mqtt

PRINTERS = [
    {"name": "A1", "host": "10.10.3.1", "access_code": "b85c7d20"},
    {"name": "A2", "host": "10.10.3.2", "access_code": "4ea05951"},
    {"name": "A3", "host": "10.10.3.3", "access_code": "13e2d9f9"},
    {"name": "A4", "host": "10.10.3.4", "access_code": "c3bc09cd"},
    {"name": "A5", "host": "10.10.3.5", "access_code": "b7c190f7"},
]

found = {}


class SerialFinder:
    def __init__(self, printer):
        self.printer = printer
        self.client = mqtt.Client()

    def on_connect(self, client, userdata, flags, rc, properties=None):
        print(f"[{self.printer['name']}] Connected with result code: {rc}")
        client.subscribe("device/+/report")
        print(f"[{self.printer['name']}] Waiting for report topic...")

    def on_message(self, client, userdata, msg):
        parts = msg.topic.split("/")
        if len(parts) >= 3:
            serial = parts[1]
            if self.printer["name"] not in found:
                found[self.printer["name"]] = serial
                print(f"[FOUND] {self.printer['name']} -> {serial}")

    def start(self):
        try:
            self.client.username_pw_set("bblp", self.printer["access_code"])
            self.client.tls_set(cert_reqs=ssl.CERT_NONE)
            self.client.tls_insecure_set(True)

            self.client.on_connect = self.on_connect
            self.client.on_message = self.on_message

            print(f"[{self.printer['name']}] Connecting to {self.printer['host']}:8883")
            self.client.connect(self.printer["host"], 8883, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"[{self.printer['name']}] Connection error: {e}")


clients = []

for printer in PRINTERS:
    finder = SerialFinder(printer)
    finder.start()
    clients.append(finder)

print("\nListening for printer topics...\n")

try:
    for _ in range(30):
        time.sleep(1)
        if len(found) == len(PRINTERS):
            break
except KeyboardInterrupt:
    pass

print("\n=== DISCOVERED SERIALS ===")
for printer in PRINTERS:
    name = printer["name"]
    print(f'{name}: "{found.get(name, "NOT_FOUND")}"')

for finder in clients:
    finder.client.loop_stop()
    finder.client.disconnect()
