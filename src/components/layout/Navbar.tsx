import React from 'react';
import { ViewType } from '../../types';

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
    <nav className="bg-white border-b border-lab-accent px-6 py-3 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center gap-8">
        {/* FIELD LAB Logo - 3D printed embossed style */}
        <div className="flex items-center select-none">
          {/* FIELD - cream background with embossed purple letters */}
          <div 
            className="px-4 py-2.5 rounded-l-lg"
            style={{ 
              backgroundColor: '#F2F0E6', // Warm cream
              boxShadow: `
                inset 0 1px 2px rgba(255,255,255,0.8),
                inset 0 -1px 2px rgba(0,0,0,0.1),
                0 2px 4px rgba(0,0,0,0.08)
              `,
              border: '1px solid rgba(139, 92, 246, 0.15)'
            }}
          >
            <span 
              className="text-2xl font-black"
              style={{ 
                color: 'transparent',
                backgroundColor: '#7C3AED', // Deeper purple
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                textShadow: '0px 1px 0px rgba(255,255,255,0.3)',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                letterSpacing: '0.12em',
                // Embossed effect
                filter: 'drop-shadow(0px 1px 0px rgba(0,0,0,0.1))'
              }}
            >
              FIELD
            </span>
          </div>
          
          {/* LAB - purple background with embossed cream letters */}
          <div 
            className="px-4 py-2.5 rounded-r-lg -ml-px"
            style={{ 
              backgroundColor: '#7C3AED', // Purple
              boxShadow: `
                inset 0 1px 2px rgba(255,255,255,0.2),
                inset 0 -1px 3px rgba(0,0,0,0.3),
                0 2px 4px rgba(0,0,0,0.15)
              `,
              border: '1px solid rgba(139, 92, 246, 0.3)'
            }}
          >
            <span 
              className="text-2xl font-black"
              style={{ 
                color: '#F2F0E6', // Cream
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                letterSpacing: '0.12em',
                textShadow: '0px -1px 1px rgba(0,0,0,0.3), 0px 1px 1px rgba(255,255,255,0.1)'
              }}
            >
              LAB
            </span>
          </div>
        </div>

        {/* Navigation */}
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
      </div>
      
      {/* User Avatar */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-lab-accent flex items-center justify-center text-lab-primary font-bold text-xs">
          OP
        </div>
      </div>
    </nav>
  );
};
