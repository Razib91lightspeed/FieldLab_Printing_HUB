import React from 'react';
import { Printer, Clock, Layers, Thermometer, Zap } from 'lucide-react';
import { PrinterData } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface Props {
  printer: PrinterData;
  onClick: () => void;
}

export const PrinterCard: React.FC<Props> = ({ printer, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-lab-accent p-5 cursor-pointer hover:shadow-md hover:border-lab-secondary transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${printer.status === 'error' ? 'bg-red-50 text-red-500' : 'bg-lab-accent text-lab-primary'}`}>
            <Printer size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lab-text group-hover:text-lab-primary transition-colors">
              {printer.name}
            </h3>
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
  );
};
