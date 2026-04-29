import ssl
import json
import paho.mqtt.client as mqtt

from bambu_to_fiware import update_printer

PRINTER = {
    "name": "Bambu A2",
    "host": "10.10.3.2",
    "access_code": "4a24ff3f",
    "serial": "00M09A3C0600792"
}


def on_connect(client, userdata, flags, rc):
    print("Connected with result code", rc)
    topic = f"device/{PRINTER['serial']}/report"
    client.subscribe(topic)
    print(f"Subscribed to {topic}")


def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        data = json.loads(payload)

        print("RAW MQTT:", data)

        p = data.get("print", {})
        progress = p.get("percent", 0)
        status = p.get("gcode_state", "Unknown")
        job_name = p.get("subtask_name", "None")
        nozzle_temp = p.get("nozzle_temper", 0)
        bed_temp = p.get("bed_temper", 0)

        print(f"Parsed → {progress}% | {status} | Job: {job_name} | Nozzle: {nozzle_temp} | Bed: {bed_temp}")

        update_printer(
            PRINTER["name"],
            progress,
            status,
            job_name,
            nozzle_temp,
            bed_temp
        )

    except Exception as e:
        print("Error parsing MQTT:", e)


def main():
    client = mqtt.Client()

    client.username_pw_set("bblp", PRINTER["access_code"])
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)

    client.on_connect = on_connect
    client.on_message = on_message

    print("Connecting to printer...")
    client.connect(PRINTER["host"], 8883, 60)
    client.loop_forever()


if __name__ == "__main__":
    main()
