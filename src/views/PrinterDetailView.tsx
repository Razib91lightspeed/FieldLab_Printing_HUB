import React from 'react';
import { ChevronLeft, Activity, Thermometer, Layers, Wind, Pause, Play, Square } from 'lucide-react';
import { PrinterData } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

interface Props {
  printer: PrinterData;
  onBack: () => void;
}

export const PrinterDetailView: React.FC<Props> = ({ printer, onBack }) => {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-lab-subtext hover:text-lab-primary mb-6 transition-colors"
      >
        <ChevronLeft size={20} />
        Back to Fleet
      </button>

      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-lab-text">{printer.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={printer.status} />
            <span className="text-lab-subtext">•</span>
            <span className="text-lab-subtext">IP: 192.168.1.{10 + parseInt(printer.id.slice(1))}</span>
          </div>
        </div>
        <div className="flex gap-3">
           <button className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title="Pause"><Pause size={20} /></button>
           <button className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title="Resume"><Play size={20} /></button>
           <button className="p-3 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Stop"><Square size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-lab-accent p-6">
          <h2 className="text-lg font-bold text-lab-text mb-4 flex items-center gap-2">
            <Activity className="text-lab-primary" size={20} />
            Active Job
          </h2>
          
          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-bold text-lab-text">{printer.jobName}</span>
              <span className="text-3xl font-bold text-lab-primary">{Math.round(printer.progress)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-lab-primary h-4 rounded-full transition-all duration-1000"
                style={{ width: `${printer.progress}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-lab-bg p-4 rounded-lg">
              <div className="text-sm text-lab-subtext mb-1">Time Elapsed</div>
              <div className="text-xl font-semibold text-lab-text">{printer.elapsedTime}</div>
            </div>
            <div className="bg-lab-bg p-4 rounded-lg">
              <div className="text-sm text-lab-subtext mb-1">Time Remaining</div>
              <div className="text-xl font-semibold text-lab-text">{printer.timeRemaining}</div>
            </div>
          </div>
        </div>

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
                  <span className="font-mono font-medium">{Math.round(printer.nozzleTemp)} / {printer.nozzleTarget}°C</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${(printer.nozzleTemp / 300) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-lab-subtext">Heatbed</span>
                  <span className="font-mono font-medium">{Math.round(printer.bedTemp)} / {printer.bedTarget}°C</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(printer.bedTemp / 120) * 100}%` }}></div>
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
              <div className="w-12 h-12 rounded-full bg-gray-200 border-2 border-white shadow-sm" style={{ backgroundColor: printer.color.toLowerCase() }}></div>
              <div>
                <div className="font-bold text-lab-text">{printer.material}</div>
                <div className="text-sm text-lab-subtext">Color: {printer.color}</div>
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
