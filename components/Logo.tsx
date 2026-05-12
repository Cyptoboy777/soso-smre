import type React from 'react';

export function Logo({ className = '', style, variant = 'default' }: { className?: string; style?: React.CSSProperties; variant?: 'default' | 'opposite' }) {
  const fill = variant === 'opposite' ? '#070707' : '#ffffff';
  const glyph = variant === 'opposite' ? '#ffffff' : '#000000';

  return (
    <svg
      className={`logo-interactive ${className}`}
      viewBox="0 0 64 64"
      aria-label="SoSo Smre"
      style={{ display: 'block', ...style }}
    >
      <defs>
        {/* Gradient for the scanning dot trail */}
        <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </radialGradient>

        {/* Rotating conic gradient for the hex border */}
        <linearGradient id="hexBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00e5ff">
            <animate attributeName="stop-color" values="#00e5ff;#a855f7;#38bdf8;#00e5ff" dur="4s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#a855f7">
            <animate attributeName="stop-color" values="#a855f7;#00e5ff;#a855f7;#a855f7" dur="4s" repeatCount="indefinite" />
          </stop>
        </linearGradient>

        {/* Glow filter for accent box */}
        <filter id="accentGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Scanline filter */}
        <filter id="scanGlow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* The S-path for the dot to trace */}
        {/* Traces top→right→left→right→end following the S shape */}
        <path id="sTracePath" d="M20 21 H44 V27 H20 V30 H20 V33 H44 V39 H20 V45 H44" />
      </defs>

      <style>{`
        @keyframes hexRotate {
          to { stroke-dashoffset: -320; }
        }
        @keyframes accentPop {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.85; transform:scale(1.06); }
        }
        @keyframes scanLine {
          0%   { transform: translateY(18px); opacity:0; }
          10%  { opacity:0.9; }
          90%  { opacity:0.9; }
          100% { transform: translateY(46px); opacity:0; }
        }
        @keyframes hexBorderSpin {
          to { stroke-dashoffset: -200; }
        }

        .logo-hex-dash {
          stroke-dasharray: 10 5;
          animation: hexBorderSpin 6s linear infinite;
        }
        .logo-accent-box {
          animation: accentPop 2s ease-in-out infinite;
          transform-origin: 43px 37px;
        }
        .logo-scan {
          animation: scanLine 3s ease-in-out infinite;
        }
        /* Hover: speed everything up and add brightness */
        .logo-interactive:hover .logo-hex-dash { animation-duration: 1.5s; }
        .logo-interactive:hover .logo-accent-box { animation-duration: 0.6s; }
        .logo-interactive:hover .logo-scan { animation-duration: 1s; }
      `}</style>

      {/* === LAYER 1: Spinning dashed hex ring (color-shifting) === */}
      <path
        className="logo-hex-dash"
        d="M32 3 57 17.5v29L32 61 7 46.5v-29L32 3Z"
        fill="none"
        stroke="url(#hexBorder)"
        strokeWidth="1"
        strokeOpacity="0.5"
        strokeDasharray="10 5"
      />

      {/* === LAYER 2: Solid hex fill === */}
      <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" fill={fill} />

      {/* === LAYER 3: S Glyph === */}
      <path
        d="M20 18h24v6H20v-6zm0 6h6v6h-6v-6zm0 6h24v6H20v-6zm18 6h6v6h-6v-6zm-18 6h24v6H20v-6z"
        fill={glyph}
      />

      {/* === LAYER 4: Cyan scan-line sweeping over the S === */}
      <rect
        className="logo-scan"
        x="18" y="0" width="28" height="2"
        fill="#00e5ff"
        opacity="0.7"
        rx="1"
        filter="url(#scanGlow)"
      />

      {/* === LAYER 5: Cyan accent box with glow === */}
      <rect
        className="logo-accent-box"
        x="38" y="32" width="10" height="10"
        fill="#00e5ff"
        rx="1.5"
        filter="url(#accentGlow)"
      />

      {/* === LAYER 6: Dot tracing the S path === */}
      <circle r="2.5" fill="#00e5ff">
        <filter id="f1"><feGaussianBlur stdDeviation="1"/></filter>
        <animateMotion
          dur="4s"
          repeatCount="indefinite"
          rotate="auto"
        >
          <mpath href="#sTracePath" />
        </animateMotion>
      </circle>

      {/* Glowing halo behind the tracing dot */}
      <circle r="5" fill="url(#dotGlow)" opacity="0.5">
        <animateMotion dur="4s" repeatCount="indefinite">
          <mpath href="#sTracePath" />
        </animateMotion>
      </circle>
    </svg>
  );
}
