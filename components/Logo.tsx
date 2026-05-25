import type React from 'react';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'opposite';
  /** compact = icon only (TopBar). full = icon + all text. text = icon + name + tagline */
  mode?: 'icon' | 'compact' | 'full';
}

export function Logo({ className = '', style, variant = 'default', mode = 'icon' }: LogoProps) {
  const fill  = variant === 'opposite' ? '#070707' : '#ffffff';
  const glyph = variant === 'opposite' ? '#ffffff' : '#000000';

  const iconSize = style?.width ?? style?.height ?? 32;

  const SVGIcon = (
    <svg
      viewBox="0 0 64 64"
      aria-label="SoSo SMRE"
      style={{ display: 'block', width: iconSize, height: iconSize, flexShrink: 0 }}
      className={`logo-interactive ${mode !== 'icon' ? '' : className}`}
    >
      <defs>
        <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#00e5ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hexBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#00e5ff">
            <animate attributeName="stop-color" values="#00e5ff;#a855f7;#38bdf8;#00e5ff" dur="4s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#a855f7">
            <animate attributeName="stop-color" values="#a855f7;#00e5ff;#a855f7;#a855f7" dur="4s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        <filter id="accentGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="scanGlow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <path id="sTracePath" d="M20 21 H44 V27 H20 V30 H20 V33 H44 V39 H20 V45 H44" />
      </defs>

      <style>{`
        @keyframes hexBorderSpin { to { stroke-dashoffset: -200; } }
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
        .logo-hex-dash {
          stroke-dasharray: 10 5;
          animation: hexBorderSpin 6s linear infinite;
        }
        .logo-accent-box {
          animation: accentPop 2s ease-in-out infinite;
          transform-origin: 43px 37px;
        }
        .logo-scan { animation: scanLine 3s ease-in-out infinite; }
        .logo-interactive:hover .logo-hex-dash   { animation-duration: 1.5s; }
        .logo-interactive:hover .logo-accent-box { animation-duration: 0.6s; }
        .logo-interactive:hover .logo-scan       { animation-duration: 1s; }
      `}</style>

      {/* Spinning dashed hex ring */}
      <path className="logo-hex-dash" d="M32 3 57 17.5v29L32 61 7 46.5v-29L32 3Z"
        fill="none" stroke="url(#hexBorder)" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="10 5" />

      {/* Solid hex fill */}
      <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" fill={fill} />

      {/* S Glyph */}
      <path d="M20 18h24v6H20v-6zm0 6h6v6h-6v-6zm0 6h24v6H20v-6zm18 6h6v6h-6v-6zm-18 6h24v6H20v-6z" fill={glyph} />

      {/* Cyan scan-line */}
      <rect className="logo-scan" x="18" y="0" width="28" height="2"
        fill="#00e5ff" opacity="0.7" rx="1" filter="url(#scanGlow)" />

      {/* Cyan accent box */}
      <rect className="logo-accent-box" x="38" y="32" width="10" height="10"
        fill="#00e5ff" rx="1.5" filter="url(#accentGlow)" />

      {/* Dot tracing the S */}
      <circle r="2.5" fill="#00e5ff">
        <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
          <mpath href="#sTracePath" />
        </animateMotion>
      </circle>
      <circle r="5" fill="url(#dotGlow)" opacity="0.5">
        <animateMotion dur="4s" repeatCount="indefinite">
          <mpath href="#sTracePath" />
        </animateMotion>
      </circle>
    </svg>
  );

  // ── ICON ONLY ──
  if (mode === 'icon') {
    return (
      <svg
        className={`logo-interactive ${className}`}
        viewBox="0 0 64 64"
        aria-label="SoSo SMRE"
        style={{ display: 'block', ...style }}
      >
        <defs>
          <radialGradient id="dotGlow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#00e5ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hexBorder2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#00e5ff">
              <animate attributeName="stop-color" values="#00e5ff;#a855f7;#38bdf8;#00e5ff" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#a855f7">
              <animate attributeName="stop-color" values="#a855f7;#00e5ff;#a855f7;#a855f7" dur="4s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          <filter id="accentGlow2" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="scanGlow2">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <path id="sTracePath2" d="M20 21 H44 V27 H20 V30 H20 V33 H44 V39 H20 V45 H44" />
        </defs>
        <style>{`
          @keyframes hexBorderSpin2 { to { stroke-dashoffset: -200; } }
          @keyframes accentPop2 { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.85;transform:scale(1.06);} }
          @keyframes scanLine2 { 0%{transform:translateY(18px);opacity:0;}10%{opacity:.9;}90%{opacity:.9;}100%{transform:translateY(46px);opacity:0;} }
          .logo-hd  { stroke-dasharray:10 5; animation:hexBorderSpin2 6s linear infinite; }
          .logo-ab  { animation:accentPop2 2s ease-in-out infinite; transform-origin:43px 37px; }
          .logo-sc  { animation:scanLine2 3s ease-in-out infinite; }
          .logo-interactive:hover .logo-hd { animation-duration:1.5s; }
          .logo-interactive:hover .logo-ab { animation-duration:.6s; }
          .logo-interactive:hover .logo-sc { animation-duration:1s; }
        `}</style>
        <path className="logo-hd" d="M32 3 57 17.5v29L32 61 7 46.5v-29L32 3Z" fill="none" stroke="url(#hexBorder2)" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="10 5" />
        <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" fill={fill} />
        <path d="M20 18h24v6H20v-6zm0 6h6v6h-6v-6zm0 6h24v6H20v-6zm18 6h6v6h-6v-6zm-18 6h24v6H20v-6z" fill={glyph} />
        <rect className="logo-sc" x="18" y="0" width="28" height="2" fill="#00e5ff" opacity="0.7" rx="1" filter="url(#scanGlow2)" />
        <rect className="logo-ab" x="38" y="32" width="10" height="10" fill="#00e5ff" rx="1.5" filter="url(#accentGlow2)" />
        <circle r="2.5" fill="#00e5ff">
          <animateMotion dur="4s" repeatCount="indefinite" rotate="auto"><mpath href="#sTracePath2" /></animateMotion>
        </circle>
        <circle r="5" fill="url(#dotGlow2)" opacity="0.5">
          <animateMotion dur="4s" repeatCount="indefinite"><mpath href="#sTracePath2" /></animateMotion>
        </circle>
      </svg>
    );
  }

  // ── COMPACT: icon + "SoSo SMRE" (Sidebar expanded) ──
  if (mode === 'compact') {
    return (
      <div className={`logo-interactive ${className}`} style={{ display: 'flex', alignItems: 'center', gap: 12, ...style }}>
        {SVGIcon}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', whiteSpace: 'nowrap' }}>
          <span style={{
            fontSize: 15, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
            background: 'linear-gradient(135deg, #ffffff 40%, #a855f7 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            SoSo SMRE
          </span>
          <span style={{ fontSize: 7.5, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.16em', opacity: 0.9, marginTop: 1 }}>
            SMART MONEY RESEARCH ENGINE
          </span>
        </div>
      </div>
    );
  }

  // ── FULL: icon + "SoSo SMRE" + "SMART MONEY ENGINE" (Login, splash) ──
  return (
    <div className={`logo-interactive ${className}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, ...style }}>
      {SVGIcon}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 26, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
          background: 'linear-gradient(135deg, #ffffff 20%, #38bdf8 55%, #a855f7 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          SoSo SMRE
        </div>
        <div style={{
          marginTop: 5, fontSize: 8, fontWeight: 800, letterSpacing: '0.22em',
          color: '#38bdf8', opacity: 0.75,
        }}>
          SMART MONEY RESEARCH ENGINE
        </div>
      </div>
    </div>
  );
}
