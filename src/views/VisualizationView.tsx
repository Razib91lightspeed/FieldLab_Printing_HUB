import React, { useEffect, useState } from 'react';
import { PrinterData, PrinterStatus } from '../types';
import { Printer, Zap } from 'lucide-react';
import { Logo } from '../components/common/Logo';

interface Props {
  printers: PrinterData[];
  onBack: () => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, unit, subtext }) => (
  <div 
    className="rounded-2xl p-8 bg-white transform transition-all duration-300 hover:translate-y-[-6px] relative overflow-hidden group"
    style={{ 
      boxShadow: `
        0 4px 6px -1px rgba(0, 0, 0, 0.05),
        0 10px 15px -3px rgba(124, 58, 237, 0.1),
        0 20px 30px -5px rgba(124, 58, 237, 0.08),
        0 40px 60px -10px rgba(124, 58, 237, 0.05),
        inset 0 1px 0 0 rgba(255, 255, 255, 1),
        inset 0 -2px 0 0 rgba(124, 58, 237, 0.05)
      `,
      border: '1px solid rgba(124, 58, 237, 0.08)'
    }}
  >
    {/* Top highlight */}
    <div 
      className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: 'linear-gradient(90deg, transparent, #8B5CF6, transparent)' }}
    />
    
    {/* Inner gradient for 3D effect */}
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, transparent 50%, rgba(124,58,237,0.02) 100%)'
      }}
    />
    
    <div className="relative z-10">
      <p className="text-purple-600 font-bold text-sm uppercase tracking-wider mb-4">{title}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <span 
          className="text-6xl font-black text-black"
          style={{ 
            textShadow: '0 1px 0 rgba(255,255,255,1), 0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(124,58,237,0.1)'
          }}
        >
          {value}
        </span>
        {unit && <span className="text-2xl font-medium text-purple-400">{unit}</span>}
      </div>
      {subtext && <p className="text-gray-500 font-medium">{subtext}</p>}
    </div>
  </div>
);

const PrinterStatusBar: React.FC<{ printer: PrinterData }> = ({ printer }) => {
  const statusConfig: Record<PrinterStatus, { bg: string; text: string; bar: string; gradient: string }> = {
    printing: { 
      bg: 'bg-purple-50', 
      text: 'text-purple-700', 
      bar: 'bg-purple-600',
      gradient: 'linear-gradient(145deg, #F3E8FF 0%, #E9D5FF 100%)'
    },
    idle: { 
      bg: 'bg-gray-50', 
      text: 'text-gray-600', 
      bar: 'bg-gray-400',
      gradient: 'linear-gradient(145deg, #F9FAFB 0%, #F3F4F6 100%)'
    },
    error: { 
      bg: 'bg-red-50', 
      text: 'text-red-600', 
      bar: 'bg-red-500',
      gradient: 'linear-gradient(145deg, #FEF2F2 0%, #FEE2E2 100%)'
    },
    finished: { 
      bg: 'bg-green-50', 
      text: 'text-green-600', 
      bar: 'bg-green-500',
      gradient: 'linear-gradient(145deg, #F0FDF4 0%, #DCFCE7 100%)'
    }
  };

  const config = statusConfig[printer.status];

  return (
    <div 
      className="rounded-xl p-5 transform transition-all duration-300 hover:translate-y-[-3px] hover:scale-[1.02] relative overflow-hidden group"
      style={{ 
        background: config.gradient,
        boxShadow: `
          0 2px 4px -1px rgba(0, 0, 0, 0.05),
          0 6px 10px -2px rgba(0, 0, 0, 0.05),
          0 12px 20px -4px rgba(124, 58, 237, 0.08),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.8),
          inset 0 -1px 0 0 rgba(0, 0, 0, 0.03)
        `,
        border: '1px solid rgba(124, 58, 237, 0.06)'
      }}
    >
      {/* Top edge highlight */}
      <div 
        className="absolute top-0 left-4 right-4 h-px opacity-60"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }}
      />
      
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div 
            className={`w-3 h-3 rounded-full ${config.bar}`}
            style={{ 
              boxShadow: '0 0 8px currentColor, 0 2px 4px rgba(0,0,0,0.2)',
              filter: 'brightness(1.1)'
            }}
          />
          <span 
            className="font-bold text-xl text-black"
            style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8), 0 2px 2px rgba(0,0,0,0.05)' }}
          >
            {printer.name}
          </span>
        </div>
        <span className={`font-bold ${config.text} uppercase tracking-wide text-sm`}>{printer.status}</span>
      </div>
      
      <div 
        className="w-full rounded-full h-2.5 mb-3 overflow-hidden relative"
        style={{ 
          background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.04) 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.5)'
        }}
      >
        <div 
          className={`${config.bar} h-full rounded-full transition-all duration-1000 relative`}
          style={{ 
            width: `${printer.progress}%`,
            boxShadow: '0 0 12px currentColor, inset 0 1px 0 rgba(255,255,255,0.3)',
            filter: 'brightness(1.1)'
          }}
        >
          {/* Shine effect on progress bar */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)'
            }}
          />
        </div>
      </div>
      
      <div className="flex justify-between items-center text-sm relative z-10">
        <span className="text-gray-600 font-medium">
          {printer.jobName !== '-' ? printer.jobName : 'No active job'}
        </span>
        <span 
          className="font-bold text-black"
          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}
        >
          {Math.round(printer.nozzleTemp)}°C
        </span>
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
  const totalProgress = printers.reduce((acc, p) => acc + p.progress, 0) / printers.length;
  const avgNozzleTemp = printers.reduce((acc, p) => acc + p.nozzleTemp, 0) / printers.length;
  const totalAlerts = printers.reduce((acc, p) => acc + p.alerts, 0);

  const printingPrinters = printers.filter(p => p.status === 'printing');

  return (
    <div className="min-h-screen p-8" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)' }}>
      {/* Header with 3D Logo */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="mb-3">
            <Logo size="lg" />
          </div>
          <p className="text-purple-400 font-medium text-lg">Live Production Dashboard</p>
        </div>
        
        <div className="text-right">
          <div 
            className="text-5xl font-black text-black"
            style={{ 
              textShadow: '0 1px 0 rgba(255,255,255,1), 0 2px 4px rgba(0,0,0,0.08), 0 4px 8px rgba(124,58,237,0.08)'
            }}
          >
            {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-purple-400 font-medium mt-1">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        <StatCard 
          title="Active Jobs"
          value={activePrinters}
          unit="/ 5"
          subtext="printers running"
        />
        <StatCard 
          title="Avg Progress"
          value={Math.round(totalProgress)}
          unit="%"
          subtext="fleet completion"
        />
        <StatCard 
          title="Avg Temperature"
          value={Math.round(avgNozzleTemp)}
          unit="°C"
          subtext="nozzle average"
        />
        <StatCard 
          title={errorPrinters > 0 ? "Attention" : "Status"}
          value={errorPrinters > 0 ? errorPrinters : "OK"}
          unit={errorPrinters > 0 ? "ERRORS" : ""}
          subtext={totalAlerts > 0 ? `${totalAlerts} warnings` : "all systems normal"}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-8">
        {/* Printer Status List */}
        <div>
          <h2 
            className="text-black font-bold text-xl mb-4 flex items-center gap-2"
            style={{ textShadow: '0 1px 0 rgba(255,255,255,1)' }}
          >
            <Printer className="text-purple-600" size={24} />
            Printer Status
          </h2>
          <div className="space-y-4">
            {printers.map(printer => (
              <PrinterStatusBar key={printer.id} printer={printer} />
            ))}
          </div>
        </div>

        {/* Active Jobs Detail */}
        <div>
          <h2 
            className="text-black font-bold text-xl mb-4 flex items-center gap-2"
            style={{ textShadow: '0 1px 0 rgba(255,255,255,1)' }}
          >
            <Zap className="text-purple-600" size={24} />
            Currently Printing
          </h2>
          
          {printingPrinters.length === 0 ? (
            <div 
              className="rounded-2xl p-12 text-center transform transition-all duration-300 hover:translate-y-[-3px]"
              style={{ 
                background: 'linear-gradient(145deg, #FAF5FF 0%, #F3E8FF 100%)',
                boxShadow: `
                  0 4px 6px -1px rgba(0, 0, 0, 0.05),
                  0 10px 15px -3px rgba(124, 58, 237, 0.1),
                  0 20px 30px -5px rgba(124, 58, 237, 0.05),
                  inset 0 1px 0 0 rgba(255, 255, 255, 1)
                `,
                border: '1px solid rgba(124, 58, 237, 0.08)'
              }}
            >
              <p className="text-purple-400 font-medium text-xl">No active print jobs</p>
            </div>
          ) : (
            <div className="space-y-4">
              {printingPrinters.map(printer => (
                <div 
                  key={printer.id}
                  className="rounded-2xl p-6 transform transition-all duration-300 hover:translate-y-[-4px] hover:scale-[1.01] relative overflow-hidden group"
                  style={{ 
                    background: 'linear-gradient(145deg, #FFFFFF 0%, #FAFAFA 50%, #F5F3FF 100%)',
                    boxShadow: `
                      0 4px 6px -1px rgba(0, 0, 0, 0.05),
                      0 10px 15px -3px rgba(124, 58, 237, 0.1),
                      0 20px 30px -5px rgba(124, 58, 237, 0.08),
                      0 40px 60px -10px rgba(124, 58, 237, 0.05),
                      inset 0 1px 0 0 rgba(255, 255, 255, 1),
                      inset 0 -2px 0 0 rgba(124, 58, 237, 0.05)
                    `,
                    border: '1px solid rgba(124, 58, 237, 0.1)',
                    borderLeft: '4px solid #7C3AED'
                  }}
                >
                  {/* Top highlight line */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'linear-gradient(90deg, #8B5CF6, #A78BFA, #8B5CF6)' }}
                  />
                  
                  {/* Inner gradient overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, transparent 40%, rgba(124,58,237,0.03) 100%)'
                    }}
                  />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <h3 
                        className="text-xl font-bold text-black"
                        style={{ textShadow: '0 1px 0 rgba(255,255,255,1), 0 2px 2px rgba(0,0,0,0.05)' }}
                      >
                        {printer.name}
                      </h3>
                      <p className="text-purple-600 font-medium">{printer.jobName}</p>
                    </div>
                    <div className="text-right">
                      <div 
                        className="text-4xl font-black text-purple-600"
                        style={{ 
                          textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(124,58,237,0.2)'
                        }}
                      >
                        {Math.round(printer.progress)}%
                      </div>
                      <p className="text-gray-500 font-medium">{printer.timeRemaining} left</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-purple-100 relative z-10">
                    <div>
                      <p className="text-xs text-purple-400 uppercase tracking-wide font-bold mb-1">Nozzle</p>
                      <p 
                        className="text-2xl font-bold text-black"
                        style={{ textShadow: '0 1px 0 rgba(255,255,255,1)' }}
                      >
                        {Math.round(printer.nozzleTemp)}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-400 uppercase tracking-wide font-bold mb-1">Bed</p>
                      <p 
                        className="text-2xl font-bold text-black"
                        style={{ textShadow: '0 1px 0 rgba(255,255,255,1)' }}
                      >
                        {Math.round(printer.bedTemp)}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-400 uppercase tracking-wide font-bold mb-1">Material</p>
                      <p 
                        className="text-2xl font-bold text-black"
                        style={{ textShadow: '0 1px 0 rgba(255,255,255,1)' }}
                      >
                        {printer.material}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Exit Button with 3D effect */}
      <button
        onClick={onBack}
        className="fixed bottom-8 right-8 px-6 py-3 text-white rounded-full font-bold transform transition-all duration-300 hover:translate-y-[-3px] hover:scale-105 relative overflow-hidden group"
        style={{ 
          background: 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
          boxShadow: `
            0 4px 6px -1px rgba(124, 58, 237, 0.3),
            0 10px 15px -3px rgba(124, 58, 237, 0.3),
            0 20px 30px -5px rgba(124, 58, 237, 0.2),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 0 rgba(0, 0, 0, 0.1)
          `
        }}
      >
        {/* Button shine effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)'
          }}
        />
        <span className="relative z-10">Exit Display Mode</span>
      </button>
    </div>
  );
};
