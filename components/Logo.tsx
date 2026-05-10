import type React from 'react';

export function Logo({ className = '', style, variant = 'default' }: { className?: string; style?: React.CSSProperties; variant?: 'default' | 'opposite' }) {
  const fill = variant === 'opposite' ? '#ffffff' : '#f97316';
  const glyph = variant === 'opposite' ? '#070707' : '#ffffff';

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
      <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" fill={fill} />
      <path d="M22 19h21v8H30v5h12v8H22V19Z" fill={glyph} />
      <path d="M22 37h21v8H22v-8Z" fill={glyph} />
      <path d="M39 31h8v8h-8v-8Z" fill="#16d9ff" />
    </svg>
  );
}
