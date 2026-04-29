from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import signal
from datetime import datetime

app = Flask(__name__)
CORS(app)

CONFIG_PATH = "/home/fieldlab/Desktop/bambu-fiware/printers.json"

def read_config():
    """Read current configuration"""
    try:
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e), "printers": []}

def write_config(config):
    """Write configuration to file"""
    try:
        config['last_updated'] = datetime.now().isoformat()
        with open(CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Write error: {e}")
        return False

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok", 
        "timestamp": datetime.now().isoformat(),
        "service": "bambu-config-api"
    })

@app.route('/printers', methods=['GET'])
def get_printers():
    """Get current printer configuration"""
    return jsonify(read_config())

@app.route('/update-printer', methods=['POST'])
def update_printer():
    """
    Receive update from Dashboard
    Body: { printerId, ip, accessCode }
    """
    try:
        data = request.json
        printer_id = data.get('printerId')
        new_ip = data.get('ip')
        new_code = data.get('accessCode')
        
        if not printer_id or not new_ip or not new_code:
            return jsonify({"error": "Missing required fields"}), 400
        
        config = read_config()
        
        # Find and update printer
        updated = False
        for printer in config['printers']:
            if printer['id'] == printer_id:
                old_ip = printer['ip']
                old_code = printer['access_code'][:4] + "****"
                
                printer['ip'] = new_ip
                printer['access_code'] = new_code
                printer['last_updated'] = datetime.now().isoformat()
                printer['is_pipeline_healthy'] = False  # Will be set to True on successful reconnect
                updated = True
                
                print(f"[API] Updated {printer_id}: IP {old_ip}->{new_ip}, Code changed")
                break
        
        if not updated:
            return jsonify({"error": "Printer not found"}), 404
        
        # Save to disk (this triggers mqtt_bridge.py to reload via file watcher)
        if write_config(config):
            return jsonify({
                "success": True,
                "message": f"Updated {printer_id}. MQTT Bridge will reload automatically.",
                "timestamp": datetime.now().isoformat()
            })
        else:
            return jsonify({"error": "Failed to save configuration"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/pipeline-status', methods=['POST'])
def update_pipeline_status():
    """Dashboard reports pipeline health status"""
    try:
        data = request.json
        printer_id = data.get('printerId')
        is_healthy = data.get('isHealthy')
        
        if not printer_id:
            return jsonify({"error": "Missing printerId"}), 400
        
        config = read_config()
        for printer in config['printers']:
            if printer['id'] == printer_id:
                printer['is_pipeline_healthy'] = is_healthy
                if not is_healthy:
                    printer['last_error'] = datetime.now().isoformat()
                break
        
        write_config(config)
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run on port 5000, accessible from network (0.0.0.0)
    print("Starting Config API on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)
