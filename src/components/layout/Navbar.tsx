import React from 'react';
import { Logo } from '../common/Logo';
import { ViewType } from '../../types';

interface Props {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { label: string; view: ViewType }[] = [
  { label: 'Dashboard', view: 'fleet' },
  { label: 'Alerts', view: 'alerts' },
  { label: 'Display', view: 'visualization' },
  { label: 'Booking', view: 'booking' },
  { label: 'Settings', view: 'settings' },
];

export const Navbar: React.FC<Props> = ({ currentView, onViewChange }) => {
  const isActive = (view: ViewType) => {
    if (view === 'fleet') {
      return currentView === 'fleet' || currentView === 'detail';
    }
    return currentView === view;
  };

  return (
    <nav className="bg-white border-b border-lab-accent px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Logo size="md" />

        <div className="flex items-center gap-8">
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