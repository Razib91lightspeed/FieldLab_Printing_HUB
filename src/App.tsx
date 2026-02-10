import React, { useState, useEffect } from 'react';
import {
  Printer,
  Activity,
  AlertCircle,
  Thermometer,
  Clock,
  Layers,
  Pause,
  Play,
  Square,
  ChevronLeft,
  Zap,
  Wind,
  History
} from 'lucide-react';

// --- Types & Interfaces ---

type PrinterStatus = 'printing' | 'idle' | 'error' | 'finished';

interface PrinterData {
  id: string;
  name: string;
  status: PrinterStatus;
  jobName: string;
  progress: number;
  timeRemaining: string; // e.g., "2h 15m"
  elapsedTime: string;
  nozzleTemp: number;
  nozzleTarget: number;
  bedTemp: number;
  bedTarget: number;
  material: string;
  color: string;
  alerts: number;
}

// --- Mock Data Generator ---

const INITIAL_PRINTERS: PrinterData[] = [
  { id: 'p1', name: 'Lab-Printer-A1', status: 'printing', jobName: 'Housing_V2.stl', progress: 65, timeRemaining: '1h 20m', elapsedTime: '2h 10m', nozzleTemp: 215, nozzleTarget: 215, bedTemp: 60, bedTarget: 60, material: 'PLA', color: 'Red', alerts: 0 },
  { id: 'p2', name: 'Lab-Printer-A2', status: 'idle', jobName: '-', progress: 0, timeRemaining: '-', elapsedTime: '-', nozzleTemp: 24, nozzleTarget: 0, bedTemp: 24, bedTarget: 0, material: 'PETG', color: 'Clear', alerts: 0 },
  { id: 'p3', name: 'Lab-Printer-B1', status: 'error', jobName: 'Gear_Shift.gcode', progress: 12, timeRemaining: 'Stalled', elapsedTime: '15m', nozzleTemp: 180, nozzleTarget: 200, bedTemp: 60, bedTarget: 60, material: 'ABS', color: 'Black', alerts: 2 },
  { id: 'p4', name: 'Lab-Printer-B2', status: 'printing', jobName: 'Bracket_Support.stl', progress: 89, timeRemaining: '12m', elapsedTime: '4h 05m', nozzleTemp: 250, nozzleTarget: 250, bedTemp: 90, bedTarget: 90, material: 'ASA', color: 'Blue', alerts: 0 },
  { id: 'p5', name: 'Lab-Printer-C1', status: 'finished', jobName: 'Test_Cube.gcode', progress: 100, timeRemaining: 'Done', elapsedTime: '45m', nozzleTemp: 35, nozzleTarget: 0, bedTemp: 30, bedTarget: 0, material: 'PLA', color: 'White', alerts: 1 },
];

// --- Components ---

const StatusBadge = ({ status }: { status: PrinterStatus }) => {
  const styles = {
    printing: 'bg-blue-100 text-blue-700 border-blue-200',
    idle: 'bg-gray-100 text-gray-600 border-gray-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    finished: 'bg-green-100 text-green-700 border-green-200',
  };

  const labels = {
    printing: 'Printing',
    idle: 'Idle',
    error: 'Error',
    finished: 'Finished',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// --- Main Application ---

function App() {
  const [view, setView] = useState<'fleet' | 'detail' | 'alerts'>('fleet');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [printers, setPrinters] = useState<PrinterData[]>(INITIAL_PRINTERS);

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPrinters(currentPrinters =>
        currentPrinters.map(p => {
          if (p.status === 'printing') {
            // Simulate progress
            const newProgress = Math.min(p.progress + 0.5, 99);
            return { ...p, progress: newProgress, nozzleTemp: p.nozzleTemp + (Math.random() - 0.5) };
          }
          return p;
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const selectedPrinter = printers.find(p => p.id === selectedPrinterId);

  // --- Views ---

  const renderFleetView = () => (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-lab-text">Lab Overview</h1>
          <p className="text-lab-subtext mt-1">Real-time monitoring of 5 active stations</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setView('alerts')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-lab-secondary text-lab-primary rounded-lg shadow-sm hover:bg-lab-accent transition-colors"
          >
            <AlertCircle size={18} />
            <span>View Alerts</span>
          </button>
          <div className="text-right">
            <div className="text-2xl font-bold text-lab-primary">{printers.filter(p => p.status === 'printing').length}</div>
            <div className="text-xs text-lab-subtext uppercase tracking-wide">Active Jobs</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {printers.map((printer) => (
          <div
            key={printer.id}
            onClick={() => {
              setSelectedPrinterId(printer.id);
              setView('detail');
            }}
            className="bg-white rounded-xl shadow-sm border border-lab-accent p-5 cursor-pointer hover:shadow-md hover:border-lab-secondary transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${printer.status === 'error' ? 'bg-red-50 text-red-500' : 'bg-lab-accent text-lab-primary'}`}>
                  <Printer size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lab-text group-hover:text-lab-primary transition-colors">{printer.name}</h3>
                  <StatusBadge status={printer.status} />
                </div>
              </div>
              {printer.alerts > 0 && (
                <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  {printer.alerts}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-lab-subtext font-medium">Job Progress</span>
                  <span className="font-bold text-lab-text">{Math.round(printer.progress)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-1000 ${printer.status === 'error' ? 'bg-red-500' : 'bg-lab-primary'}`}
                    style={{ width: `${printer.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                <div className="flex items-center gap-2 text-sm text-lab-subtext">
                  <Layers size={16} />
                  <span className="truncate">{printer.jobName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-lab-subtext">
                  <Clock size={16} />
                  <span>{printer.timeRemaining}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-lab-subtext">
                  <Thermometer size={16} />
                  <span>Nozzle: {Math.round(printer.nozzleTemp)}°C</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-lab-subtext">
                  <Zap size={16} />
                  <span>{printer.material}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailView = () => {
    if (!selectedPrinter) return null;
    const p = selectedPrinter;

    return (
      <div className="p-6 max-w-5xl mx-auto animate-fade-in">
        <button
          onClick={() => setView('fleet')}
          className="flex items-center gap-2 text-lab-subtext hover:text-lab-primary mb-6 transition-colors"
        >
          <ChevronLeft size={20} />
          Back to Fleet
        </button>

        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-bold text-lab-text">{p.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={p.status} />
              <span className="text-lab-subtext">•</span>
              <span className="text-lab-subtext">IP: 192.168.1.{10 + parseInt(p.id.slice(1))}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title="Pause"><Pause size={20} /></button>
            <button className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title="Resume"><Play size={20} /></button>
            <button className="p-3 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Stop"><Square size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Job Card */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-lab-accent p-6">
            <h2 className="text-lg font-bold text-lab-text mb-4 flex items-center gap-2">
              <Activity className="text-lab-primary" size={20} />
              Active Job
            </h2>

            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-bold text-lab-text">{p.jobName}</span>
                <span className="text-3xl font-bold text-lab-primary">{Math.round(p.progress)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-lab-primary h-4 rounded-full transition-all duration-1000"
                  style={{ width: `${p.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-lab-bg p-4 rounded-lg">
                <div className="text-sm text-lab-subtext mb-1">Time Elapsed</div>
                <div className="text-xl font-semibold text-lab-text">{p.elapsedTime}</div>
              </div>
              <div className="bg-lab-bg p-4 rounded-lg">
                <div className="text-sm text-lab-subtext mb-1">Time Remaining</div>
                <div className="text-xl font-semibold text-lab-text">{p.timeRemaining}</div>
              </div>
            </div>
          </div>

          {/* Telemetry Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6">
              <h2 className="text-lg font-bold text-lab-text mb-4 flex items-center gap-2">
                <Thermometer className="text-orange-500" size={20} />
                Temperatures
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-lab-subtext">Nozzle</span>
                    <span className="font-mono font-medium">{Math.round(p.nozzleTemp)} / {p.nozzleTarget}°C</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${(p.nozzleTemp / 300) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-lab-subtext">Heatbed</span>
                    <span className="font-mono font-medium">{Math.round(p.bedTemp)} / {p.bedTarget}°C</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(p.bedTemp / 120) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6">
              <h2 className="text-lg font-bold text-lab-text mb-4 flex items-center gap-2">
                <Layers className="text-lab-secondary" size={20} />
                Material
              </h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 border-2 border-white shadow-sm" style={{ backgroundColor: p.color.toLowerCase() }}></div>
                <div>
                  <div className="font-bold text-lab-text">{p.material}</div>
                  <div className="text-sm text-lab-subtext">Color: {p.color}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6">
              <h2 className="text-lg font-bold text-lab-text mb-4 flex items-center gap-2">
                <Wind className="text-cyan-500" size={20} />
                Fans
              </h2>
              <div className="flex justify-between items-center">
                <span className="text-sm text-lab-subtext">Part Cooling</span>
                <span className="font-mono">85%</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-lab-subtext">Hotend</span>
                <span className="font-mono">100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAlertsView = () => (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <button
        onClick={() => setView('fleet')}
        className="flex items-center gap-2 text-lab-subtext hover:text-lab-primary mb-6 transition-colors"
      >
        <ChevronLeft size={20} />
        Back to Fleet
      </button>

      <h1 className="text-3xl font-bold text-lab-text mb-6 flex items-center gap-3">
        <History className="text-lab-primary" />
        System Alerts
      </h1>

      <div className="bg-white rounded-xl shadow-sm border border-lab-accent overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-lab-bg border-b border-lab-accent">
            <tr>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Time</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Printer</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Severity</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Message</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50">
              <td className="p-4 text-sm text-lab-text">10:42 AM</td>
              <td className="p-4 text-sm font-medium text-lab-text">Lab-Printer-B1</td>
              <td className="p-4"><span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Critical</span></td>
              <td className="p-4 text-sm text-lab-text">Thermal Runaway Detected</td>
              <td className="p-4"><span className="text-red-500 font-medium">Active</span></td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="p-4 text-sm text-lab-text">09:15 AM</td>
              <td className="p-4 text-sm font-medium text-lab-text">Lab-Printer-C1</td>
              <td className="p-4"><span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">Warning</span></td>
              <td className="p-4 text-sm text-lab-text">Filament Runout</td>
              <td className="p-4"><span className="text-green-600 font-medium">Resolved</span></td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="p-4 text-sm text-lab-text">Yesterday</td>
              <td className="p-4 text-sm font-medium text-lab-text">Lab-Printer-A2</td>
              <td className="p-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Info</span></td>
              <td className="p-4 text-sm text-lab-text">Firmware Update Available</td>
              <td className="p-4"><span className="text-lab-subtext font-medium">Pending</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-lab-bg font-sans text-lab-text">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-lab-accent px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-lab-primary text-white p-2 rounded-lg">
            <Printer size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight text-lab-text">PrintLab <span className="text-lab-primary">OS</span></span>
        </div>
        <div className="flex gap-6 text-sm font-medium text-lab-subtext">
          <button onClick={() => setView('fleet')} className={`hover:text-lab-primary transition-colors ${view === 'fleet' ? 'text-lab-primary' : ''}`}>Dashboard</button>
          <button onClick={() => setView('alerts')} className={`hover:text-lab-primary transition-colors ${view === 'alerts' ? 'text-lab-primary' : ''}`}>Alerts</button>
          <button className="hover:text-lab-primary transition-colors">Settings</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-lab-accent flex items-center justify-center text-lab-primary font-bold text-xs">
            OP
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main>
        {view === 'fleet' && renderFleetView()}
        {view === 'detail' && renderDetailView()}
        {view === 'alerts' && renderAlertsView()}
      </main>
    </div>
  );
}

export default App;