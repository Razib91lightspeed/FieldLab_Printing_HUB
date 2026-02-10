# FIELDLAB - 3D Printer Monitoring Dashboard

A modern, real-time dashboard for monitoring Bambu Lab 3D printers in lab environments. Features a clean white/purple design with 3D visual effects, live data visualization, and a dedicated large-display mode for wall-mounted screens.

![FIELDLAB Dashboard](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3.0-06B6D4?logo=tailwindcss)

## Features

### Core Functionality
- **Real-time Monitoring**: Live temperature, progress, and status updates for all printers
- **Fleet Overview**: Dashboard showing all 5 printers at a glance
- **Detailed View**: Deep-dive into individual printer telemetry
- **Alert System**: Centralized error tracking and history
- **Large Display Mode**: Optimized visualization page for wall-mounted displays

### Visual Design
- **3D Depth Effects**: Cards, buttons, and logo with realistic shadows and gradients
- **FIELDLAB Branding**: Custom logo matching your 3D printed sign (cream + purple)
- **Color Scheme**: Clean white, black, and purple palette
- **Responsive Layout**: Works on desktop, tablet, and large displays

### Data Visualization
- **Progress Bar Chart**: Compare print completion across all printers
- **Status Pie Chart**: Visual breakdown of printer states
- **Material Usage Chart**: Distribution of filament types in use
- **Live Statistics**: Active jobs, average progress, temperature averages

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS with custom 3D shadow effects
- **Charts**: Recharts library
- **Icons**: Lucide React
- **Build Tool**: Create React App

---

## 📂 Project Structure

```text
printer-lab-dashboard/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Logo.tsx          # Reusable FIELDLAB logo
│   │   │   └── StatusBadge.tsx   # Status indicator component
│   │   ├── layout/
│   │   │   └── Navbar.tsx        # Navigation bar
│   │   └── printer/
│   │       └── PrinterCard.tsx   # Printer card component
│   ├── views/
│   │   ├── FleetView.tsx         # Main dashboard
│   │   ├── PrinterDetailView.tsx # Single printer details
│   │   ├── AlertsView.tsx        # Alert history
│   │   └── VisualizationView.tsx # Large display mode
│   ├── hooks/
│   │   └── usePrinters.ts        # Live data simulation hook
│   ├── data/
│   │   ├── mockPrinters.ts       # Mock printer data (Bambu A1-A5)
│   │   └── mockAlerts.ts         # Mock alert data
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── utils/
│   │   ├── constants.ts          # App constants
│   │   └── formatters.ts         # Data formatters
│   ├── App.tsx                   # Main application
│   └── index.tsx                 # Entry point
├── tailwind.config.js            # Tailwind configuration
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- **Node.js 16+**
- **npm or yarn**

### Installation

1. **Clone or create the project**
   ```bash
   npx create-react-app printer-lab-dashboard --template typescript
   cd printer-lab-dashboard
   ```
2. **Install core dependencies**
    ```bash
    npm install
    ```
3. **Install additional UI packages**
    ```bash
    npm install recharts lucide-react
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
    ```
## 🛠️ Configuration
1. **Configure Tailwind**
**Update your tailwind.config.js with the custom lab theme:**

```bash
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


2. **Add Tailwind Directives**
**Add the following to the top of your src/index.css:**

```bash
@tailwind base;
@tailwind components;
@tailwind utilities;
```
## 💻 Usage
3. **Development Server**
```bash
npm start
```
View the app at
```bash
http://localhost:3000.
```

### Navigation Guide

| Page | Description | Access |
| :--- | :--- | :--- |
| **Dashboard** | Fleet overview with all 5 printers | Click "Dashboard" in nav |
| **Printer Detail** | Individual printer telemetry | Click any printer card |
| **Alerts** | Error history and warnings | Click "Alerts" in nav |
| **Display Mode** | Large visualization for wall screens | Click "Display" in nav |

### Display Mode (Wall Mount)
The Display page is optimized for 24/7 monitoring on large screens:
- **Auto-updating** charts and statistics.
- **High Contrast** text readable from 10+ feet away.
- **Full-Screen** experience (hidden navbar).

---
### Navigation Guide

| Page | Description | Access |
| :--- | :--- | :--- |
| **Dashboard** | Fleet overview with all 5 printers | Click "Dashboard" in nav |
| **Printer Detail** | Individual printer telemetry | Click any printer card |
| **Alerts** | Error history and warnings | Click "Alerts" in nav |
| **Display Mode** | Large visualization for wall screens | Click "Display" in nav |

### Display Mode (Wall Mount)
The Display page is optimized for 24/7 monitoring on large screens:
- **Auto-updating** charts and statistics.
- **High Contrast** text readable from 10+ feet away.
- **Full-Screen** experience (hidden navbar).

---

### ⚙️ Customization

#### Change Printer Names
Edit `src/data/mockPrinters.ts`:
```typescript
export const INITIAL_PRINTERS: PrinterData[] = [
  { id: 'p1', name: 'Bambu-X1-Carbon', ... },
];
```


#### Change Printer Names
Edit `src/data/mockPrinters.ts`:
```typescript
export const INITIAL_PRINTERS: PrinterData[] = [
  { id: 'p1', name: 'Bambu-X1-Carbon', ... },
];
```

#### Connect Real Data
Replace the simulation logic in `src/hooks/usePrinters.ts` with your API:
```typescript
// Example:
const response = await fetch('https://your-api-endpoint.com/printers');
const data = await response.json();
setPrinters(data);
```

---

### ⚠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| `react-scripts` not found | Run `npm install` |
| Module not found | Delete `node_modules` and `npm install` |
| Port 3000 in use | `PORT=3001 npm start` |
| Charts not rendering | Ensure `recharts` is installed via npm |

---

### 🔮 Future Enhancements
- [ ] WebSocket integration for real-time telemetry.
- [ ] Dark mode toggle.
- [ ] Material inventory tracking.
- [ ] Print time estimation AI.
- [ ] Mobile app companion.

---

### 📄 License
MIT License - Feel free to use and modify for your lab.

**Credits:** Design inspired by FIELDLAB 3D signs. Built with Tailwind CSS and Recharts.
