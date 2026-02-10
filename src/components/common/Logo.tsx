import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<Props> = ({ size = 'md' }) => {
  const sizes = {
    sm: { text: 'text-lg', padding: 'px-3 py-1.5' },
    md: { text: 'text-xl', padding: 'px-4 py-2' },
    lg: { text: 'text-3xl', padding: 'px-5 py-3' }
  };

  const s = sizes[size];

  return (
    <div className="flex items-center select-none transform hover:scale-105 transition-transform duration-300">
      {/* FIELD - bright white background, purple text with 3D depth */}
      <div
        className={`${s.padding} rounded-l-xl relative overflow-hidden`}
        style={{
          background: 'linear-gradient(145deg, #FFFFFF 0%, #FAFAFA 50%, #FFFFFF 100%)',
          boxShadow: `
            inset 0 1px 1px rgba(255,255,255,0.9),
            inset 0 -1px 1px rgba(0,0,0,0.04),
            4px 4px 8px rgba(0,0,0,0.12),
            8px 8px 16px rgba(0,0,0,0.08),
            -2px -2px 4px rgba(255,255,255,0.7)
          `,
          border: '2px solid #F0F0F0',
          borderRight: 'none'
        }}
      >
        {/* Highlight overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.02) 100%)'
          }}
        />
        <span
          className={`${s.text} font-black tracking-tight relative z-10`}
          style={{
            color: '#7C3AED',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '0.05em',
            textShadow: `
              0 1px 0 rgba(255,255,255,0.6),
              0 -1px 0 rgba(0,0,0,0.08),
              0 2px 4px rgba(124,58,237,0.2)
            `
          }}
        >
          FIELD
        </span>
      </div>

      {/* LAB - purple background, white text with 3D depth */}
      <div
        className={`${s.padding} rounded-r-xl relative overflow-hidden`}
        style={{
          background: 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
          boxShadow: `
            inset 0 1px 1px rgba(255,255,255,0.2),
            inset 0 -1px 1px rgba(0,0,0,0.2),
            4px 4px 8px rgba(124,58,237,0.3),
            8px 8px 16px rgba(124,58,237,0.2),
            -2px -2px 4px rgba(255,255,255,0.1)
          `,
          border: '2px solid #6D28D9',
          borderLeft: 'none'
        }}
      >
        {/* Highlight overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.15) 100%)'
          }}
        />
        <span
          className={`${s.text} font-black tracking-tight relative z-10`}
          style={{
            color: '#FFFFFF',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '0.05em',
            textShadow: `
              0 1px 0 rgba(255,255,255,0.2),
              0 -1px 0 rgba(0,0,0,0.2),
              0 2px 4px rgba(0,0,0,0.2)
            `
          }}
        >
          LAB
        </span>
      </div>
    </div>
  );
};