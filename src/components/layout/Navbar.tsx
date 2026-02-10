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
    { label: 'Display', view: 'visualization' },
  ];

  // 3D text effect style for navigation
  const navTextStyle = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textShadow: '0px 1px 0px rgba(255,255,255,0.8), 0px -1px 0px rgba(0,0,0,0.1)',
    letterSpacing: '0.02em'
  };

  return (
    <nav 
      className="border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10"
      style={{ backgroundColor: '#F3F4F6' }}
    >
      <div className="flex items-center gap-8">
        {/* FIELDLAB Logo */}
        <div className="flex items-center select-none">
          <div 
            className="px-3 py-2 rounded-l-md shadow-sm"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            <span 
              className="text-xl font-black tracking-tight"
              style={{ 
                color: '#7C3AED',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.02em'
              }}
            >
              FIELD
            </span>
          </div>
          
          <div 
            className="px-3 py-2 rounded-r-md shadow-sm"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <span 
              className="text-xl font-black tracking-tight"
              style={{ 
                color: '#FFFFFF',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.02em'
              }}
            >
              LAB
            </span>
          </div>
        </div>

        {/* Navigation with 3D effect */}
        <div className="flex gap-6 text-sm font-bold">
          {navItems.map(({ label, view }) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`transition-all hover:scale-105 ${
                currentView === view ? 'text-purple-600' : 'text-gray-600'
              }`}
              style={navTextStyle}
            >
              {label}
            </button>
          ))}
          <button 
            className="text-gray-600 transition-all hover:scale-105"
            style={navTextStyle}
          >
            Settings
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm"
          style={{ 
            backgroundColor: '#E5E7EB',
            color: '#374151',
            textShadow: '0px 1px 0px rgba(255,255,255,0.8)'
          }}
        >
          OP
        </div>
      </div>
    </nav>
  );
};
