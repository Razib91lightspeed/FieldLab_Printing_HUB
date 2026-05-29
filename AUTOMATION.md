# FieldLab 3D Printer Dashboard Automation Guide

This document explains how the FieldLab 3D Printer Dashboard is deployed and automatically updated on the Windows VM.

The VM is used as the dashboard host for the lab display. The Raspberry Pi remains responsible for collecting printer MQTT data and sending telemetry to FIWARE. The VM serves the frontend dashboard and runs supporting backend services for dashboard data, visualization, and Peppi booking integration.

---

## 1. Current System Architecture

Bambu printers / isolated printer network
        ↓ MQTT
Raspberry Pi bridge/backend
        ↓ sends telemetry
FIWARE Orion-LD / QuantumLeap
        ↓ dashboard reads data
Windows VM
        ↓ serves dashboard UI
Lab monitor / campus devices

* **VM IP Address:** 172.16.101.22
* **Dashboard URL (Inside campus/lab network):** [http://172.16.101.22:3000](http://172.16.101.22:3000)

---

## 2. VM Project Location

The deployed project is located on the VM at:
C:\Users\kn\Desktop\FieldLab_Printing_HUB

⚠️ CRITICAL: This folder must not be deleted. It is the live deployment folder used by GitHub Actions and PM2. The VM folder is automatically updated when changes are pushed to the main branch on GitHub.

---

## 3. Services Running on the VM

The VM runs three main services:

| Service | Purpose | Port |
| :--- | :--- | :--- |
| fieldlab-frontend | Serves the production React dashboard | 3000 |
| fieldlab-printers-backend | Supports printer dashboard/visualization backend logic | 4000 |
| fieldlab-peppi-backend | Provides Peppi booking/schedule data | 5001 |

These services are managed by PM2.

---

## 4. PM2 Process Manager

PM2 keeps the dashboard processes running in the background.

* Check running services:
  ```powershell
pm2.cmd list
```
* Restart all services:
```powershell
  pm2.cmd restart all
```
* Restart individual services:
```powershell
  pm2.cmd restart fieldlab-frontend
  pm2.cmd restart fieldlab-printers-backend
  pm2.cmd restart fieldlab-peppi-backend
```
* View live logs:
```powershell
  pm2.cmd logs
```
* Save current process list:
```powershell
  pm2.cmd save
```
* Restore saved services:
```powershell
  pm2.cmd resurrect
```
---

## 5. PM2 Services Initialization

The background services were started using the following commands:

pm2.cmd start "C:\Users\kn\Desktop\FieldLab_Printing_HUB\printers_backend\index.js" --name fieldlab-printers-backend
pm2.cmd start "C:\Users\kn\Desktop\FieldLab_Printing_HUB\peppi_backend\index.js" --name fieldlab-peppi-backend
pm2.cmd start "C:\Users\kn\Desktop\FieldLab_Printing_HUB\node_modules\serve\build\main.js" --name fieldlab-frontend -- -s "C:\Users\kn\Desktop\FieldLab_Printing_HUB\build" -l tcp://0.0.0.0:3000

# After starting, the process list was saved permanently:
```powershell
pm2.cmd save
```
---

## 6. Auto-Restart After VM Reboot

A Windows startup task is configured to automatically restore PM2 services whenever the VM restarts.

* The task executing on boot: pm2.cmd resurrect
* Check the scheduled task details:
  schtasks /Query /TN "FieldLab PM2 Restore" /V /FO LIST
* Manually trigger the restore task:
  schtasks /Run /TN "FieldLab PM2 Restore"

💡 Note: After restarting the VM, wait 1–2 minutes, run pm2.cmd list to check status, and then open [http://172.16.101.22:3000](http://172.16.101.22:3000).

---

## 7. GitHub Actions Deployment Automation

The project uses a GitHub Actions self-hosted runner installed directly on the VM. When code is pushed to the main branch, GitHub Actions builds and updates the VM dynamically.

Developer pushes to main
        ↓
GitHub Actions starts
        ↓
Self-hosted runner on VM receives job
        ↓
VM updates local project folder
        ↓
Frontend is rebuilt
        ↓
PM2 services restart
        ↓
Dashboard updates at 172.16.101.22:3000

---

## 8. GitHub Self-Hosted Runner Configurations

* Installation Directory: C:\actions-runner
* Target Repository: Razib91lightspeed/FieldLab_Printing_HUB
* Runner Label: fieldlab-vm
* Runner User Account: PROJECT-VM-BAMB\kn (Runs as a Windows service)

### Runner Management Commands (PowerShell)

* Check if runner service is active:
```powershell
  Get-Service | Where-Object {$_.Name -like "actions.runner*"} | Format-Table Name, Status, StartType
```
* Restart the runner service:
```powershell
  Get-Service | Where-Object {$_.Name -like "actions.runner*"} | Restart-Service
```

---

## 9. Deployment Workflow File

The workflow automation logic is located at .github/workflows/deploy-vm.yml:

```powershell
[Workflow Configuration Settings]
name: Deploy FieldLab Dashboard to VM
on:
  push:
    branches:
      - main
jobs:
  deploy:
    runs-on: [self-hosted, fieldlab-vm]
    steps:
      - name: Deploy latest code on VM
        shell: powershell
        run: |
          $ErrorActionPreference = "Stop"
          cd "C:\Users\kn\Desktop\FieldLab_Printing_HUB"
          git fetch origin main
          git reset --hard origin/main
          npm.cmd install
          npm.cmd run build
          pm2.cmd restart fieldlab-printers-backend
          pm2.cmd restart fieldlab-peppi-backend
          pm2.cmd restart fieldlab-frontend
          pm2.cmd save
          pm2.cmd list
```

---

## 10. Normal Development Workflow

🛑 Do not make code changes directly on the VM. Code should always be modified on your local development machine or laptop.

### Recommended Steps:
1. Make changes locally.
2. Push changes to GitHub:
```powershell
   git add .
   git commit -m "Describe the change"
   git push origin main
```
3. Check deployment status under GitHub repository → Actions tab. If the workflow turns green, the VM deployment was successful.

---

## 11. Important Warning About VM Local Changes

Because the deployment workflow executes a strict "git reset --hard origin/main", any code changes made only inside the VM folder will be permanently deleted and overwritten. Treatment of the VM folder should remain strictly as a live deployment copy.

---

## 12. Files That Must Not Be Committed

Sensitive local configurations, credentials, or runtime caches must never be pushed to GitHub. Ensure your .gitignore file includes the following entries:

```powershell
.env
*.env
printers.json
printers_backend/data/printers.json
mqtt_backend/data/printers.json
peppi_backend/data/peppi_cache.json
logs/
```
---

## 13. Common System Verification Commands

* Verify active application ports:
```powershell
  netstat -ano | findstr :3000
  netstat -ano | findstr :4000
  netstat -ano | findstr :5001
```
* Verify Git setup alignment:
```powershell
  git remote -v
```
* Check the last 5 local deployments:
```powershell
  cd "C:\Users\kn\Desktop\FieldLab_Printing_HUB"
  git log --oneline -5
```

---

## 14. Troubleshooting

### Dashboard is not opening
Check if PM2 crashed or stopped: 
```powershell
pm2.cmd list
``` 
If empty or offline, 
```powershell
run pm2.cmd resurrect 
```
or 
```powershell
pm2.cmd restart all
```

### GitHub Actions workflow is failing
Navigate to the Actions tab on GitHub and expand the logs. Common causes include:
* The VM is powered off or disconnected.
* The GitHub runner Windows service has stopped.
* PowerShell script execution is restricted.

To fix PowerShell script blocking, run this inside an administrative PowerShell window:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
Get-Service | Where-Object {$_.Name -like "actions.runner*"} | Restart-Service
```
### Port 3000 is already in use
Find the conflicting Process ID (PID):
```powershell
netstat -ano | findstr :3000
```

Force kill that explicit process:
```powershell
taskkill /PID <PID_NUMBER> /F
```

Restart the PM2 frontend thread:
```powershell
pm2.cmd restart fieldlab-frontend
```

---

## 15. Future Roadmap Improvements

* Port 80 Mapping: Migrate the current setup from [http://172.16.101.22:3000](http://172.16.101.22:3000) to standard web HTTP port 80 ([http://172.16.101.22](http://172.16.101.22)) so users and lab monitors don't have to specify a port number.
* Secure Admin Panel: Implement an internal secure admin dashboard page to add new hardware printers. 
* Data Privacy Boundaries: Sensitive printer access codes must be kept inside private backend system configuration files or safe secrets vaults. They should never be exposed to or stored inside the public FIWARE entity properties. FIWARE will remain dedicated purely to streaming sensor telemetry.

Admin enters printer details (Name, IP, Token, Serial)
        ↓
Private backend saves configuration locally
        ↓
Local infrastructure bridge auto-reloads
        ↓
Clean telemetry streams out to FIWARE
        ↓
Dashboard displays the fresh hardware safely