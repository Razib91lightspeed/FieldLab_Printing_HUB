import React from 'react';
import { Logo } from '../common/Logo';
import { ViewType } from '../../types';

interface Props {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  dateString?: string;
  timeString?: string;
}

const navItems: { label: string; view: ViewType }[] = [
  { label: 'Dashboard', view: 'fleet' },
  { label: 'Alerts', view: 'alerts' },
  { label: 'Display', view: 'visualization' },
  { label: 'Booking', view: 'booking' },
  { label: 'Settings', view: 'settings' },
];

export const Navbar: React.FC<Props> = ({ 
  currentView, 
  onViewChange, 
  dateString, 
  timeString 
}) => {
  const isActive = (view: ViewType) => {
    if (view === 'fleet') {
      return currentView === 'fleet' || currentView === 'detail';
    }
    return currentView === view;
  };

  return (
    <nav className="bg-white border-b border-lab-accent px-6 py-4 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Left container block holding Logo + Manual Tuning Clock */}
        <div className="flex items-center flex-1">
          <div className="flex-shrink-0">
            <Logo size="md" />
          </div>

          {/* CLOCK CONTAINER - Tweak the ml-[180px] below to manually position left/right */}
          {dateString && timeString && (
            <div className="ml-[240px] inline-flex items-center rounded-xl overflow-hidden border border-slate-200/80 shadow-[0_4px_10px_rgba(124,58,237,0.15)] bg-white transition-all duration-300 hover:shadow-[0_6px_16px_rgba(124,58,237,0.22)]">
              {/* Left Side: White Date Component */}
              <div className="px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-purple-700 bg-white border-r border-slate-100 whitespace-nowrap">
                {dateString}
              </div>
              
              {/* Right Side: 3D Purple Time Gradient Component */}
              <div className="px-4 py-1.5 font-mono text-xs font-extrabold tracking-widest text-white bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] whitespace-nowrap">
                {timeString}
              </div>
            </div>
          )}
        </div>

        {/* Right navigation menu links */}
        <div className="flex items-center gap-8 flex-shrink-0">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => onViewChange(item.view)}
              className={`font-semibold transition-colors ${
                isActive(item.view)
                  ? 'text-lab-primary'
                  : 'text-lab-subtext hover:text-lab-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

      </div>
    </nav>
  );
};