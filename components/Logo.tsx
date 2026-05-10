import type React from 'react';

export function Logo({ className = '', style, variant = 'default' }: { className?: string; style?: React.CSSProperties; variant?: 'default' | 'opposite' }) {
  const fill = variant === 'opposite' ? '#070707' : '#ffffff';
  const glyph = variant === 'opposite' ? '#ffffff' : '#000000';

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-label="SoSo Smre"
      style={{
        display: 'block',
        ...style,
      }}
    >
      {/* Hexagon Background */}
      <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" fill={fill} />
      
      {/* Blocky 'S' Glyph */}
      <path 
        d="M20 18h24v6H20v-6zm0 6h6v6h-6v-6zm0 6h24v6H20v-6zm18 6h6v6h-6v-6zm-18 6h24v6H20v-6z" 
        fill={glyph} 
      />

      {/* Cyan Accent Box */}
      <rect x="38" y="32" width="10" height="10" fill="#00e5ff" rx="1" />
    </svg>
  );
}
