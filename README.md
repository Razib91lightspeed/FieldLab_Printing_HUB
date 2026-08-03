# FIELDLAB – 3D Printer Monitoring & Booking Compliance Dashboard

A modern **real-time monitoring dashboard** for Bambu Lab 3D printers used in laboratory environments such as **FIELDLAB**.

The system provides:

- Fleet monitoring of multiple printers
- Booking compliance verification
- Utilization analytics
- Visualization dashboards for large displays

The platform integrates **3D printer telemetry and booking data** to ensure printers are used according to lab reservation schedules.

---

![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.3.0-06B6D4?logo=tailwindcss)

---

# Overview

FIELDLAB Dashboard helps **lab managers, researchers, and students** monitor multiple 3D printers simultaneously.

The system combines:

- Printer monitoring
- Booking compliance verification
- Utilization analytics
- Visualization dashboards

The interface is optimized for **large display screens used in laboratory spaces**, allowing teams to quickly identify printer activity and booking compliance.

---

# Key Features

## Real-Time Fleet Monitoring

- Monitor **all printers simultaneously**
- Track **print progress and status**
- Visual indicators for **activity and booking compliance**

---

## Booking Compliance Monitoring

The system integrates **Peppi / TUNI booking data** to determine whether a printer is being used according to reservation schedules.

Possible system states:

| Printer State | Booking Status | Result |
|---------------|---------------|--------|
| Printing + Booking | Authorized usage |
| Printing + No Booking | Unauthorized usage |
| Booked + Not Printing | Reserved |
| Not Booked + Not Printing | Idle |

This allows the system to detect **improper printer usage in shared labs**.

---

## Utilization Tracking

Printer utilization is calculated dynamically using booking time.

```
utilizationRate =
(currentTime - bookingStart) /
(bookingEnd - bookingStart)
```

This value is displayed as a **progress bar in each printer card**.

---

## Visualization Dashboard

The system includes a **visual analytics dashboard** showing:

- Booking status distribution
- Printer utilization rates
- Fleet-level statistics
- Average usage metrics

Charts are implemented using **Recharts**.

---

## Large Display Mode

Designed for **wall-mounted screens in laboratory environments**.

Features include:

- High contrast UI
- Large typography
- Auto-refreshing data
- Easy-to-read printer status indicators

---

# Tech Stack

### Frontend

- React 18
- TypeScript
- Tailwind CSS

### Visualization

- Recharts

### UI Components

- Lucide React Icons

### Build System

- Create React App

Future integrations:

- Bambu printer telemetry
- MQTT
- FIWARE data platform

---

# System Architecture

The dashboard integrates **printer data and booking data** through a layered architecture.

```
Peppi Booking API --> https://peppi-utils.tuni.fi/tilakalenteri/
        |
        v
bookingAdapter.ts
        |
        v
React Dashboard State
        |
        v
Visualization UI
```

### Future Architecture (with Telemetry)

The future system will combine **printer telemetry and booking compliance monitoring**.

```
Bambu Printer MQTT
        |
        v
Node / FIWARE Bridge
        |
        v
React Dashboard
        |
        v
Booking Compliance Engine
```

---

# Project Structure

```
printer-lab-dashboard/
│
├── public/
│   └── index.html
│
├── src/
│
│   ├── components/
│   │   ├── common/
│   │   │   ├── Logo.tsx
│   │   │   └── StatusBadge.tsx
│   │   │
│   │   ├── layout/
│   │   │   └── Navbar.tsx
│   │   │
│   │   └── printer/
│   │       └── PrinterCard.tsx
│
│   ├── views/
│   │   ├── FleetView.tsx
│   │   ├── PrinterDetailView.tsx
│   │   ├── AlertsView.tsx
│   │   └── BookingVizView.tsx
│
│   ├── data/
│   │   ├── peppiApi.ts
│   │   ├── mockPrinters.ts
│   │   ├── mockBookings.ts
│   │   └── mockAlerts.ts
│
│   ├── utils/
│   │   └── bookingAdapter.ts
│
│   ├── types/
│   │   └── index.ts
│
│   ├── hooks/
│   │   └── usePrinters.ts
│
│   ├── App.tsx
│   └── index.tsx
│
├── tailwind.config.js
└── package.json
```

---

# Getting Started

## Prerequisites

- Node.js **16+**
- npm or yarn

---

# Installation

Create the project:

```bash
npx create-react-app printer-lab-dashboard --template typescript
cd printer-lab-dashboard
```

Install dependencies:

```bash
npm install
```

Install UI libraries:

```bash
npm install recharts lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

# Tailwind Configuration

Update `tailwind.config.js`

```javascript
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: '#F8F7FC',
          primary: '#8B5CF6',
          secondary: '#A78BFA',
          accent: '#EDE9FE',
        }
      }
    },
  },
  plugins: [],
}
```

Add Tailwind directives in `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

# Running the Application

Start development server:

```bash
npm start
```

Open:

```
http://localhost:3000
```

---

# Dashboard Navigation

| Page | Description |
|-----|-------------|
Dashboard | Fleet overview of all printers |
Printer Detail | Individual printer telemetry |
Alerts | Error and alert history |
Booking Visualization | Booking compliance dashboard |
Display Mode | Large screen visualization |

---

# Booking System Integration

The dashboard currently integrates with **Peppi booking data**.

Example API endpoint:

```
GET /api/peppi
```

Expected booking fields:

```
bookingId
printerId
userName
startTime
endTime
status
```

The booking adapter maps this data into the dashboard printer model.

---

# Customization

## Change Printer Names

Edit:

```
src/data/mockPrinters.ts
```

Example:

```typescript
export const INITIAL_PRINTERS = [
  { id: "p1", name: "Bambu A1" },
  { id: "p2", name: "Bambu A2" },
  { id: "p3", name: "Bambu A3" },
  { id: "p4", name: "Bambu A4" },
  { id: "p5", name: "Bambu A5" }
]
```

---

# Troubleshooting

| Problem | Solution |
|--------|---------|
react-scripts not found | Run `npm install`
Modules missing | Delete `node_modules` and reinstall
Port already in use | `PORT=3001 npm start`
Charts not rendering | Ensure `recharts` installed

---

# Backend Integration

The dashboard frontend does not communicate directly with the Peppi booking system.  
Instead, a **backend proxy service** is used to retrieve booking data and expose it to the dashboard.

This approach avoids authentication issues, CORS restrictions, and security risks.

---

# Data Flow

The data pipeline currently works as follows:

```
Peppi Booking System
        │
        ▼
Backend API Proxy
        │
        ▼
React Frontend
        │
        ▼
bookingAdapter.ts
        │
        ▼
Dashboard UI Components
```

---

# Backend API Endpoint

The frontend retrieves booking data using:

```
GET http://localhost:4000/api/peppi
```

Example request from the frontend:

```typescript
const response = await fetch("http://localhost:4000/api/peppi");
const bookings = await response.json();
```

The backend service fetches the original data from the Peppi system and returns a simplified dataset for the dashboard.

---

# Example Backend Response

Example booking object returned by the API:

```json
{
  "id": "booking_123",
  "resourceIds": ["3D tulostin_F0-16, Bambu A1"],
  "title": "Robotics project printing",
  "start": "02.03.2026 11.45",
  "end": "02.03.2026 14.30",
  "description": "More information: 0442317246, Juuso Huhtiniemi\nTeacher: Ville Jouppila"
}
```

Fields returned by the backend:

| Field | Description |
|------|-------------|
| id | Booking ID |
| resourceIds | Printer resource identifier |
| title | Booking purpose |
| start | Booking start time |
| end | Booking end time |
| description | Additional information including user name |

---

# Data Mapping Layer

The dashboard does not use raw API data directly.

Instead, the **bookingAdapter.ts** file converts the API response into the format required by the dashboard UI.

Location:

```
src/utils/bookingAdapter.ts
```

Responsibilities of this layer:

- Map Peppi printer names to internal printer IDs
- Detect active bookings
- Extract user names
- Normalize date formats
- Attach booking data to printers

Example mapping output:

```typescript
{
  printerId: "p1",
  printerName: "Bambu A1",
  hasActiveBooking: true,
  currentBooking: {
      id: "booking_123",
      title: "Robotics project printing",
      start: "02.03.2026 11.45",
      end: "02.03.2026 14.30"
  }
}
```

---

# Booking Status Calculation

The frontend calculates the printer booking state using the following logic:

```
if (printer has active booking)
    status = "with-booking"
else
    status = "idle"
```

The dashboard then calculates printer utilization using:

```
utilizationRate =
(currentTime - bookingStart) /
(bookingEnd - bookingStart)
```

This value is displayed as a progress bar inside each printer card.

---

# User Name Extraction

Peppi booking descriptions contain user names inside the description field.

Example:

```
More information: 0442317246, Juuso Huhtiniemi
Teacher: Ville Jouppila
```

The dashboard extracts the user name using pattern matching.

Example logic:

```
Teacher: <name>
```

or

```
PhoneNumber, <name>
```

---

# Backend Proxy (Example)

A minimal backend proxy can be implemented using Node.js.

Example Express server:

```javascript
const express = require("express");
const fetch = require("node-fetch");

const app = express();

app.get("/api/peppi", async (req, res) => {

    const response = await fetch("https://tuni.booking.system/api/bookings");

    const data = await response.json();

    res.json(data);

});

app.listen(4000, () => {
    console.log("Peppi proxy running on port 4000");
});
```

This backend protects the Peppi API and simplifies data consumption by the frontend.

---

# Future Backend Architecture

Future versions of the system will integrate **real printer telemetry**.

```
Bambu Printer MQTT
        │
        ▼
Telemetry Collector
        │
        ▼
Backend Service
        │
        ▼
React Dashboard
```

This will allow the system to detect:

| Printer State | Booking | Result |
|---------------|---------|--------|
Printing | Yes | Authorized usage |
Printing | No | Unauthorized usage |
Booked | Not printing | Reserved |
Idle | No booking | Available |

---

# Future Enhancements

Planned backend improvements include:

- MQTT integration with Bambu printers
- Telemetry storage database
- WebSocket real-time updates
- FIWARE integration
- Usage analytics
- Automatic violation detection

---

# License

MIT License

---

# Acknowledgment

Developed for **FIELDLAB 3D Printing Environment** to support monitoring, analytics, and operational efficiency in shared fabrication laboratories.
