import ssl
import json
import time
import os
import signal
import sys
import requests
from datetime import datetime
from threading import Thread, Lock, Event
import paho.mqtt.client as mqtt

# Configuration
CONFIG_PATH = "/home/fieldlab/Desktop/bambu-fiware/printers.json"
FIWARE_HOST = "172.16.101.172"
FIWARE_PORT = "1026"
FIWARE_URL = f"http://{FIWARE_HOST}:{FIWARE_PORT}/ngsi-ld/v1/entities"

# Global state
config = {}
clients = {}
config_mtime = 0
running = True
reload_event = Event()
lock = Lock()

def load_config():
    """Load printer configuration from JSON"""
    global config, config_mtime
    try:
        with open(CONFIG_PATH, 'r') as f:
            new_config = json.load(f)
            config_mtime = os.path.getmtime(CONFIG_PATH)
            
            with lock:
                config = new_config
                print(f"[{datetime.now()}] Config loaded: {len(new_config['printers'])} printers")
                return new_config
    except Exception as e:
        print(f"Error loading config: {e}")
        return config

def save_config():
    """Save current config to JSON"""
    global config
    try:
        with lock:
            config['last_updated'] = datetime.now().isoformat()
            with open(CONFIG_PATH, 'w') as f:
                json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def send_to_fiware(printer_id, data):
    """Send data to FIWARE Orion Context Broker using NGSI-LD"""
    entity_id = f"urn:ngsi-ld:Device:3DPrinter:{printer_id}"
    
    headers = {
        "Content-Type": "application/ld+json",
        "Fiware-Service": "openiot",
        "Fiware-ServicePath": "/"
    }
    
    # NGSI-LD format (as per PowerPoint document)
    payload = {
        "id": entity_id,
        "type": "Device",
        "status": {
            "type": "Property",
            "value": data.get("state", "UNKNOWN")
        },
        "progress": {
            "type": "Property", 
            "value": float(data.get("progress", 0))
        },
        "nozzleTemp": {
            "type": "Property",
            "value": float(data.get("nozzle", 0))
        },
        "bedTemp": {
            "type": "Property",
            "value": float(data.get("bed", 0))
        },
        "jobName": {
            "type": "Property",
            "value": str(data.get("job", "N/A"))
        },
        "remainingTime": {
            "type": "Property",
            "value": float(data.get("remaining", 0))
        },
        "printerName": {
            "type": "Property",
            "value": data.get("name")
        },
        "pipelineHealthy": {
            "type": "Property",
            "value": True
        },
        "lastUpdate": {
            "type": "Property",
            "value": datetime.now().isoformat()
        }
    }
    
    try:
        # Try to create/update entity
        create_url = f"{FIWARE_URL}/{entity_id}/attrs"
        response = requests.post(create_url, headers=headers, json=payload, timeout=5)
        
        if response.status_code == 404:
            # Entity doesn't exist, create it
            create_payload = {
                "id": entity_id,
                "type": "Device",
                **payload
            }
            response = requests.post(FIWARE_URL, headers=headers, json=create_payload, timeout=5)
            if response.status_code in [200, 201, 204]:
                print(f"[{data.get('name')}] Created entity in FIWARE")
            else:
                print(f"[{data.get('name')}] Create failed: {response.status_code}")
        elif response.status_code in [200, 201, 204]:
            pass  # Success, don't spam console
        else:
            print(f"[{data.get('name')}] Update failed: {response.status_code}")
            
    except Exception as e:
        print(f"[{data.get('name')}] FIWARE send error: {e}")

def create_printer_callback(printer_config):
    """Create message callback for specific printer"""
    def on_message(client, userdata, msg):
        try:
            payload = msg.payload.decode("utf-8", errors="ignore")
            data = json.loads(payload)

            if "print" not in data:
                return

            p = data["print"]
            
            # Extract data
            extracted = {
                "name": printer_config['name'],
                "state": p.get("gcode_state", "UNKNOWN"),
                "progress": p.get("mc_percent", 0),
                "nozzle": p.get("nozzle_temper", 0),
                "bed": p.get("bed_temper", 0),
                "job": p.get("subtask_name") or p.get("gcode_file") or "N/A",
                "remaining": p.get("mc_remaining_time", 0),
                "layer_num": p.get("layer_num", 0),
                "total_layers": p.get("total_layer_num", 0)
            }
            
            print(f"[{printer_config['name']}] {extracted['state']} - {extracted['progress']}% - {extracted['job']}")
            
            # Send to FIWARE
            send_to_fiware(printer_config['id'], extracted)
            
            # Update last seen
            with lock:
                for pr in config['printers']:
                    if pr['id'] == printer_config['id']:
                        pr['last_seen'] = datetime.now().isoformat()
                        pr['is_pipeline_healthy'] = True
                        
        except Exception as e:
            print(f"[{printer_config['name']}] Parse error: {e}")
    
    return on_message

def connect_printer(printer):
    """Create and connect MQTT client for a printer"""
    client_id = f"bridge_{printer['id']}_{int(time.time())}"
    client = mqtt.Client(client_id=client_id)
    
    # Bambu Lab credentials
    client.username_pw_set("bblp", printer['access_code'])
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)
    
    # Callbacks
    on_msg = create_printer_callback(printer)
    client.on_message = on_msg
    
    def on_connect(c, userdata, flags, rc):
        if rc == 0:
            topic = f"device/{printer['serial']}/report"
            c.subscribe(topic)
            print(f"[{printer['name']}] Connected to {printer['ip']} and subscribed")
            with lock:
                for pr in config['printers']:
                    if pr['id'] == printer['id']:
                        pr['is_pipeline_healthy'] = True
        else:
            print(f"[{printer['name']}] Connection failed with code {rc}")
            with lock:
                for pr in config['printers']:
                    if pr['id'] == printer['id']:
                        pr['is_pipeline_healthy'] = False
    
    def on_disconnect(c, userdata, rc):
        print(f"[{printer['name']}] Disconnected (code {rc})")
        with lock:
            for pr in config['printers']:
                if pr['id'] == printer['id']:
                    pr['is_pipeline_healthy'] = False
    
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    
    try:
        print(f"[{printer['name']}] Connecting to {printer['ip']}:8883...")
        client.connect(printer['ip'], 8883, 60)
        client.loop_start()
        return client
    except Exception as e:
        print(f"[{printer['name']}] Connection error: {e}")
        with lock:
            for pr in config['printers']:
                if pr['id'] == printer['id']:
                    pr['is_pipeline_healthy'] = False
        return None

def disconnect_all():
    """Disconnect all MQTT clients"""
    global clients
    for pid, client in list(clients.items()):
        try:
            client.loop_stop()
            client.disconnect()
            print(f"[{pid}] Disconnected")
        except Exception as e:
            print(f"[{pid}] Error disconnecting: {e}")
    clients.clear()

def reload_printers():
    """Reload configuration and reconnect printers"""
    global clients
    
    print("Reloading configuration...")
    new_config = load_config()
    
    # Disconnect existing
    disconnect_all()
    
    time.sleep(1)  # Brief pause to ensure clean disconnect
    
    # Reconnect all enabled printers
    for printer in new_config.get('printers', []):
        if printer.get('enabled', True):
            client = connect_printer(printer)
            if client:
                clients[printer['id']] = client
                time.sleep(2)  # Stagger connections to avoid network flood
    
    print(f"Reload complete. Active connections: {len(clients)}")

def check_config_changes():
    """Watch for config file changes"""
    global config_mtime
    try:
        current_mtime = os.path.getmtime(CONFIG_PATH)
        if current_mtime != config_mtime:
            print("Config file changed on disk, reloading...")
            reload_printers()
    except Exception as e:
        print(f"Error checking config: {e}")

def signal_handler(sig, frame):
    """Handle graceful shutdown"""
    global running
    print("\nShutting down MQTT Bridge...")
    running = False
    disconnect_all()
    save_config()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    print("="*60)
    print("Bambu Lab MQTT Bridge - Multi Printer")
    print(f"FIWARE Target: {FIWARE_URL}")
    print(f"Config File: {CONFIG_PATH}")
    print("="*60)
    
    # Initial load
    reload_printers()
    
    # Main loop
    while running:
        time.sleep(10)  # Check every 10 seconds
        
        # Check for config file changes (triggered by config_api.py updates)
        check_config_changes()
        
        # Health check: ensure clients are connected
        with lock:
            for pid, client in list(clients.items()):
                if not client.is_connected():
                    printer = next((p for p in config['printers'] if p['id'] == pid), None)
                    if printer:
                        print(f"[{printer['name']}] Client disconnected, will retry...")
        
        # Save config periodically (to persist last_seen updates)
        if int(time.time()) % 60 == 0:  # Every minute
            save_config()

if __name__ == "__main__":
    main()
