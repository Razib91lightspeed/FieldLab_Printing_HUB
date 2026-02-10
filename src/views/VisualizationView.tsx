import React, { useEffect, useState } from 'react';
import { PrinterData, PrinterStatus } from '../types';
import { Activity, Thermometer, Clock, AlertTriangle, Printer, Zap } from 'lucide-react';

interface Props {
  printers: PrinterData[];
  onBack: () => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  subtext?: string;
  large?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, unit, icon, color, subtext, large }) => (
  <div 
    className="rounded-2xl p-6 flex flex-col justify-between"
    style={{ 
      backgroundColor: 'white',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.05)'
    }}
  >
    <div className="flex items-center gap-3 mb-4">
      <div 
        className="p-3 rounded-xl"
        style={{ backgroundColor: `${color}15`, color: color }}
      >
        {icon}
      </div>
      <span className="text-gray-500 font-medium text-lg uppercase tracking-wide">{title}</span>
    </div>
    
    <div>
      <div className="flex items-baseline gap-2">
        <span 
          className="font-black text-gray-800"
          style={{ fontSize: large ? '5rem' : '3.5rem', lineHeight: '1' }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-2xl text-gray-400 font-medium">{unit}</span>
        )}
      </div>
      {subtext && (
        <p className="text-gray-400 mt-2 text-lg">{subtext}</p>
      )}
    </div>
  </div>
);

const PrinterStatusBar: React.FC<{ printer: PrinterData }> = ({ printer }) => {
  const statusColors: Record<PrinterStatus, string> = {
    printing: '#3B82F6',
    idle: '#9CA3AF',
    error: '#EF4444',
    finished: '#10B981'
  };

  return (
    <div className="bg-white rounded-xl p-4 flex items-center gap-4" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div 
        className="w-4 h-4 rounded-full animate-pulse"
        style={{ backgroundColor: statusColors[printer.status] }}
      />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-xl text-gray-800">{printer.name}</span>
          <span className="text-lg text-gray-500">{printer.status.toUpperCase()}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000"
            style={{ 
              width: `${printer.progress}%`,
              backgroundColor: statusColors[printer.status]
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-400">
          <span>{printer.jobName !== '-' ? printer.jobName : 'No active job'}</span>
          <span>{printer.progress > 0 ? `${Math.round(printer.progress)}%` : ''}</span>
        </div>
      </div>
      <div className="text-right min-w-[120px]">
        <div className="text-2xl font-bold text-gray-700">{Math.round(printer.nozzleTemp)}°C</div>
        <div className="text-sm text-gray-400">Nozzle</div>
      </div>
    </div>
  );
};

export const VisualizationView: React.FC<Props> = ({ printers, onBack }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate stats
  const activePrinters = printers.filter(p => p.status === 'printing').length;
  const errorPrinters = printers.filter(p => p.status === 'error').length;
  const finishedPrinters = printers.filter(p => p.status === 'finished').length;
  const totalProgress = printers.reduce((acc, p) => acc + p.progress, 0) / printers.length;
  const avgNozzleTemp = printers.reduce((acc, p) => acc + p.nozzleTemp, 0) / printers.length;
  const totalAlerts = printers.reduce((acc, p) => acc + p.alerts, 0);

  // Get currently printing printers
  const printingPrinters = printers.filter(p => p.status === 'printing');

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 
            className="font-black text-gray-800 mb-2"
            style={{ fontSize: '3rem', letterSpacing: '-0.02em' }}
          >
            FIELDLAB
          </h1>
          <p className="text-2xl text-gray-400 font-medium">Live Production Dashboard</p>
        </div>
        
        <div className="text-right">
          <div 
            className="font-bold text-gray-800"
            style={{ fontSize: '4rem', lineHeight: '1' }}
          >
            {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-xl text-gray-400 mt-1">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Large Stats */}
        <div className="col-span-3">
          <StatCard 
            title="Active Jobs"
            value={activePrinters}
            unit="/ 5"
            icon={<Activity size={32} />}
            color="#3B82F6"
            subtext={`${finishedPrinters} completed today`}
            large
          />
        </div>
        
        <div className="col-span-3">
          <StatCard 
            title="Avg Progress"
            value={Math.round(totalProgress)}
            unit="%"
            icon={<Clock size={32} />}
            color="#8B5CF6"
            subtext="Fleet average"
            large
          />
        </div>
        
        <div className="col-span-3">
          <StatCard 
            title="Avg Nozzle Temp"
            value={Math.round(avgNozzleTemp)}
            unit="°C"
            icon={<Thermometer size={32} />}
            color="#F59E0B"
            subtext="Across all printers"
            large
          />
        </div>
        
        <div className="col-span-3">
          <StatCard 
            title={errorPrinters > 0 ? "Alerts" : "System Status"}
            value={errorPrinters > 0 ? errorPrinters : "OK"}
            unit={errorPrinters > 0 ? "ERRORS" : ""}
            icon={<AlertTriangle size={32} />}
            color={errorPrinters > 0 ? "#EF4444" : "#10B981"}
            subtext={totalAlerts > 0 ? `${totalAlerts} warnings pending` : "All systems normal"}
            large
          />
        </div>
      </div>

      {/* Bottom Section: Active Printers Detail */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Status List */}
        <div>
          <h2 
            className="font-bold text-gray-700 mb-4 flex items-center gap-3"
            style={{ fontSize: '1.5rem' }}
          >
            <Printer size={28} className="text-purple-500" />
            Printer Status
          </h2>
          <div className="space-y-4">
            {printers.map(printer => (
              <PrinterStatusBar key={printer.id} printer={printer} />
            ))}
          </div>
        </div>

        {/* Right: Active Jobs Detail */}
        <div>
          <h2 
            className="font-bold text-gray-700 mb-4 flex items-center gap-3"
            style={{ fontSize: '1.5rem' }}
          >
            <Zap size={28} className="text-blue-500" />
            Currently Printing
          </h2>
          
          {printingPrinters.length === 0 ? (
            <div 
              className="rounded-2xl p-12 text-center"
              style={{ backgroundColor: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            >
              <div className="text-6xl mb-4">😴</div>
              <p className="text-2xl text-gray-400 font-medium">No active print jobs</p>
            </div>
          ) : (
            <div className="space-y-4">
              {printingPrinters.map(printer => (
                <div 
                  key={printer.id}
                  className="rounded-2xl p-6"
                  style={{ 
                    backgroundColor: 'white',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    borderLeft: '6px solid #3B82F6'
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">{printer.name}</h3>
                      <p className="text-lg text-gray-500">{printer.jobName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-blue-500">
                        {Math.round(printer.progress)}%
                      </div>
                      <p className="text-gray-400">{printer.timeRemaining} left</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-sm text-gray-400 uppercase tracking-wide">Nozzle</p>
                      <p className="text-2xl font-bold text-gray-700">{Math.round(printer.nozzleTemp)}°C</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 uppercase tracking-wide">Bed</p>
                      <p className="text-2xl font-bold text-gray-700">{Math.round(printer.bedTemp)}°C</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 uppercase tracking-wide">Material</p>
                      <p className="text-2xl font-bold text-gray-700">{printer.material}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Back Button (hidden in real display mode, shown for testing) */}
      <button
        onClick={onBack}
        className="fixed bottom-8 right-8 px-6 py-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors font-medium"
      >
        Exit Display Mode
      </button>
    </div>
  );
};
