import React, { useEffect, useState } from 'react';
import { PrinterData, PrinterStatus } from '../types';
import { Printer, Zap, BarChart3, PieChart as PieIcon } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
    className="rounded-2xl p-6 bg-white transform transition-all duration-300 hover:translate-y-[-6px] relative overflow-hidden group"
    style={{ 
      boxShadow: `
        0 4px 6px -1px rgba(0, 0, 0, 0.05),
        0 10px 15px -3px rgba(124, 58, 237, 0.1),
        0 20px 30px -5px rgba(124, 58, 237, 0.08),
        inset 0 1px 0 0 rgba(255, 255, 255, 1),
        inset 0 -2px 0 0 rgba(124, 58, 237, 0.05)
      `,
      border: '1px solid rgba(124, 58, 237, 0.08)'
    }}
  >
    <div 
      className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: 'linear-gradient(90deg, transparent, #8B5CF6, transparent)' }}
    />
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, transparent 50%, rgba(124,58,237,0.02) 100%)'
      }}
    />
    <div className="relative z-10">
      <p className="text-purple-600 font-bold text-xs uppercase tracking-wider mb-2">{title}</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span 
          className="text-4xl font-black text-black"
          style={{ textShadow: '0 1px 0 rgba(255,255,255,1), 0 2px 4px rgba(0,0,0,0.1)' }}
        >
          {value}
        </span>
        {unit && <span className="text-lg font-medium text-purple-400">{unit}</span>}
      </div>
      {subtext && <p className="text-gray-500 font-medium text-sm">{subtext}</p>}
    </div>
  </div>
);

const PrinterStatusBar: React.FC<{ printer: PrinterData }> = ({ printer }) => {
  const statusConfig: Record<PrinterStatus, { bg: string; text: string; bar: string; gradient: string }> = {
    printing: { 
      bg: 'bg-purple-50', 
      text: 'text-purple-700', 
      bar: '#7C3AED',
      gradient: 'linear-gradient(145deg, #F3E8FF 0%, #E9D5FF 100%)'
    },
    idle: { 
      bg: 'bg-gray-50', 
      text: 'text-gray-600', 
      bar: '#9CA3AF',
      gradient: 'linear-gradient(145deg, #F9FAFB 0%, #F3F4F6 100%)'
    },
    error: { 
      bg: 'bg-red-50', 
      text: 'text-red-600', 
      bar: '#EF4444',
      gradient: 'linear-gradient(145deg, #FEF2F2 0%, #FEE2E2 100%)'
    },
    finished: { 
      bg: 'bg-green-50', 
      text: 'text-green-600', 
      bar: '#22C55E',
      gradient: 'linear-gradient(145deg, #F0FDF4 0%, #DCFCE7 100%)'
    }
  };

  const config = statusConfig[printer.status];

  return (
    <div 
      className="rounded-xl p-4 transform transition-all duration-300 hover:translate-y-[-2px] relative overflow-hidden"
      style={{ 
        background: config.gradient,
        boxShadow: `
          0 2px 4px -1px rgba(0, 0, 0, 0.05),
          0 6px 10px -2px rgba(0, 0, 0, 0.05),
          0 12px 20px -4px rgba(124, 58, 237, 0.08),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.8)
        `,
        border: '1px solid rgba(124, 58, 237, 0.06)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ 
              backgroundColor: config.bar,
              boxShadow: `0 0 8px ${config.bar}`
            }}
          />
          <span className="font-bold text-lg text-black">{printer.name}</span>
        </div>
        <span className={`font-bold ${config.text} uppercase tracking-wide text-xs`}>{printer.status}</span>
      </div>
      
      <div 
        className="w-full rounded-full h-2 mb-2 overflow-hidden"
        style={{ 
          background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.04) 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <div 
          className="h-full rounded-full transition-all duration-1000"
          style={{ 
            width: `${printer.progress}%`,
            backgroundColor: config.bar,
            boxShadow: `0 0 10px ${config.bar}`
          }}
        />
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-600 font-medium truncate max-w-[70%]">
          {printer.jobName !== '-' ? printer.jobName : 'No active job'}
        </span>
        <span className="font-bold text-black">{Math.round(printer.nozzleTemp)}°C</span>
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
  const idlePrinters = printers.filter(p => p.status === 'idle').length;
  const totalProgress = printers.reduce((acc, p) => acc + p.progress, 0) / printers.length;
  const avgNozzleTemp = printers.reduce((acc, p) => acc + p.nozzleTemp, 0) / printers.length;
  const totalAlerts = printers.reduce((acc, p) => acc + p.alerts, 0);

  const printingPrinters = printers.filter(p => p.status === 'printing');

  // Data for bar chart - progress by printer
  const progressData = printers.map(p => ({
    name: p.name.replace('Bambu ', ''),
    progress: Math.round(p.progress),
    fill: p.status === 'printing' ? '#7C3AED' : p.status === 'error' ? '#EF4444' : p.status === 'finished' ? '#22C55E' : '#9CA3AF'
  }));

  // Data for pie chart - status distribution
  const statusData = [
    { name: 'Printing', value: activePrinters, color: '#7C3AED' },
    { name: 'Idle', value: idlePrinters, color: '#9CA3AF' },
    { name: 'Error', value: errorPrinters, color: '#EF4444' },
    { name: 'Finished', value: finishedPrinters, color: '#22C55E' }
  ].filter(d => d.value > 0);

  // Material usage data
  const materialCounts = printers.reduce((acc, p) => {
    acc[p.material] = (acc[p.material] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const materialData = Object.entries(materialCounts).map(([name, value]) => ({
    name,
    value,
    color: name === 'PLA' ? '#7C3AED' : name === 'PETG' ? '#8B5CF6' : name === 'ABS' ? '#A78BFA' : '#C4B5FD'
  }));

  return (
    <div className="min-h-screen p-6 pb-24" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="mb-2">
            <Logo size="lg" />
          </div>
          <p className="text-purple-400 font-medium">Live Production Dashboard</p>
        </div>
        
        <div className="text-right">
          <div 
            className="text-4xl font-black text-black"
            style={{ textShadow: '0 1px 0 rgba(255,255,255,1), 0 2px 4px rgba(0,0,0,0.08)' }}
          >
            {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-purple-400 font-medium text-sm mt-1">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Progress Bar Chart */}
        <div 
          className="rounded-2xl p-5 bg-white col-span-2"
          style={{ 
            boxShadow: `
              0 4px 6px -1px rgba(0, 0, 0, 0.05),
              0 10px 15px -3px rgba(124, 58, 237, 0.1),
              inset 0 1px 0 0 rgba(255, 255, 255, 1)
            `,
            border: '1px solid rgba(124, 58, 237, 0.08)'
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="text-purple-600" size={20} />
            Print Progress by Printer
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={progressData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none',
                  boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.2)'
                }}
              />
              <Bar dataKey="progress" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie Chart */}
        <div 
          className="rounded-2xl p-5 bg-white"
          style={{ 
            boxShadow: `
              0 4px 6px -1px rgba(0, 0, 0, 0.05),
              0 10px 15px -3px rgba(124, 58, 237, 0.1),
              inset 0 1px 0 0 rgba(255, 255, 255, 1)
            `,
            border: '1px solid rgba(124, 58, 237, 0.08)'
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
            <PieIcon className="text-purple-600" size={20} />
            Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none',
                  boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.2)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-gray-600">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Material Chart */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div 
          className="rounded-2xl p-5 bg-white col-span-1"
          style={{ 
            boxShadow: `
              0 4px 6px -1px rgba(0, 0, 0, 0.05),
              0 10px 15px -3px rgba(124, 58, 237, 0.1),
              inset 0 1px 0 0 rgba(255, 255, 255, 1)
            `,
            border: '1px solid rgba(124, 58, 237, 0.08)'
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4">Material Usage</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={materialData}
                cx="50%"
                cy="50%"
                outerRadius={60}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {materialData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none',
                  boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.2)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Printer Status List - takes remaining space */}
        <div className="col-span-2">
          <h2 className="text-black font-bold text-lg mb-3 flex items-center gap-2">
            <Printer className="text-purple-600" size={20} />
            Printer Status
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {printers.map(printer => (
              <PrinterStatusBar key={printer.id} printer={printer} />
            ))}
          </div>
        </div>
      </div>

      {/* Currently Printing - Full Width */}
      {printingPrinters.length > 0 && (
        <div>
          <h2 className="text-black font-bold text-lg mb-3 flex items-center gap-2">
            <Zap className="text-purple-600" size={20} />
            Currently Printing
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {printingPrinters.map(printer => (
              <div 
                key={printer.id}
                className="rounded-2xl p-5 transform transition-all duration-300 hover:translate-y-[-4px] relative overflow-hidden"
                style={{ 
                  background: 'linear-gradient(145deg, #FFFFFF 0%, #FAFAFA 50%, #F5F3FF 100%)',
                  boxShadow: `
                    0 4px 6px -1px rgba(0, 0, 0, 0.05),
                    0 10px 15px -3px rgba(124, 58, 237, 0.1),
                    0 20px 30px -5px rgba(124, 58, 237, 0.08),
                    inset 0 1px 0 0 rgba(255, 255, 255, 1)
                  `,
                  border: '1px solid rgba(124, 58, 237, 0.1)',
                  borderLeft: '4px solid #7C3AED'
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-black">{printer.name}</h3>
                    <p className="text-purple-600 font-medium text-sm">{printer.jobName}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-purple-600">
                      {Math.round(printer.progress)}%
                    </div>
                    <p className="text-gray-500 text-sm">{printer.timeRemaining} left</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-purple-100">
                  <div>
                    <p className="text-xs text-purple-400 uppercase font-bold mb-1">Nozzle</p>
                    <p className="text-xl font-bold text-black">{Math.round(printer.nozzleTemp)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-400 uppercase font-bold mb-1">Bed</p>
                    <p className="text-xl font-bold text-black">{Math.round(printer.bedTemp)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-400 uppercase font-bold mb-1">Material</p>
                    <p className="text-xl font-bold text-black">{printer.material}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exit Button - Fixed to bottom right */}
      <button
        onClick={onBack}
        className="fixed bottom-6 right-6 px-6 py-3 text-white rounded-full font-bold transform transition-all duration-300 hover:translate-y-[-3px] hover:scale-105 z-50"
        style={{ 
          background: 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
          boxShadow: `
            0 10px 25px -5px rgba(124, 58, 237, 0.4),
            0 6px 10px -5px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.2)
          `
        }}
      >
        Exit Display Mode
      </button>
    </div>
  );
};
