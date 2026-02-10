import React from 'react';
import { AlertCircle } from 'lucide-react';
import { PrinterData } from '../types';
import { PrinterCard } from '../components/printer/PrinterCard';

interface Props {
  printers: PrinterData[];
  onSelectPrinter: (id: string) => void;
  onViewAlerts: () => void;
}

export const FleetView: React.FC<Props> = ({ printers, onSelectPrinter, onViewAlerts }) => {
  const activeCount = printers.filter(p => p.status === 'printing').length;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-lab-text">Lab Overview</h1>
          <p className="text-lab-subtext mt-1">Real-time monitoring of 5 active stations</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onViewAlerts}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-lab-secondary text-lab-primary rounded-lg shadow-sm hover:bg-lab-accent transition-colors"
          >
            <AlertCircle size={18} />
            <span>View Alerts</span>
          </button>
          <div className="text-right">
            <div className="text-2xl font-bold text-lab-primary">{activeCount}</div>
            <div className="text-xs text-lab-subtext uppercase tracking-wide">Active Jobs</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {printers.map((printer) => (
          <PrinterCard 
            key={printer.id} 
            printer={printer} 
            onClick={() => onSelectPrinter(printer.id)} 
          />
        ))}
      </div>
    </div>
  );
};
