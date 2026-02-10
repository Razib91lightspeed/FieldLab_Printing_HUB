import React from 'react';
import { Printer, AlertCircle } from 'lucide-react';
import { ViewType } from '../../types';
import { APP_NAME } from '../../utils/constants';

interface Props {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const Navbar: React.FC<Props> = ({ currentView, onViewChange }) => {
  const navItems: { label: string; view: ViewType }[] = [
    { label: 'Dashboard', view: 'fleet' },
    { label: 'Alerts', view: 'alerts' },
  ];

  return (
    <nav className="bg-white border-b border-lab-accent px-6 py-4 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="bg-lab-primary text-white p-2 rounded-lg">
          <Printer size={24} />
        </div>
        <span className="text-xl font-bold tracking-tight text-lab-text">
          {APP_NAME.split(' ')[0]} <span className="text-lab-primary">{APP_NAME.split(' ')[1]}</span>
        </span>
      </div>
      
      <div className="flex gap-6 text-sm font-medium text-lab-subtext">
        {navItems.map(({ label, view }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`hover:text-lab-primary transition-colors ${
              currentView === view ? 'text-lab-primary' : ''
            }`}
          >
            {label}
          </button>
        ))}
        <button className="hover:text-lab-primary transition-colors">Settings</button>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-lab-accent flex items-center justify-center text-lab-primary font-bold text-xs">
          OP
        </div>
      </div>
    </nav>
  );
};
