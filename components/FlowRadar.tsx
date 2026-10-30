'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Signature: sentinel aperture that opens with ETF net-flow magnitude. */
export function FlowRadar({
  btcInflow,
  ethInflow,
  size = 188,
}: {
  btcInflow: number | null;
  ethInflow: number | null;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const hasData = btcInflow != null || ethInflow != null;
  const net = (btcInflow ?? 0) + (ethInflow ?? 0);
  const mag = Math.min(1, Math.abs(net) / 400_000_000);
  const open = 36 + mag * 110;
  const arc = (360 - open) * 0.942;
  const gap = open * 0.942;
  const positive = net >= 0;
  const color = positive ? 'var(--success)' : 'var(--danger)';
  const tickAngle = positive ? -42 : 138;

  return (
    <div
      aria-hidden
      className="flow-radar"
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 160 160">
        <defs>
          <linearGradient id="fr-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF4F20" stopOpacity="1" />
            <stop offset="100%" stopColor="#FF7637" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id="fr-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF4F20" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#FF4F20" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#FF4F20" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="80" cy="80" r="72" fill="url(#fr-glow)" />
        <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />

        <motion.circle
          cx="80"
          cy="80"
          r="54"
          stroke="url(#fr-arc)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          initial={false}
          animate={{ strokeDasharray: `${arc} ${gap}` }}
          transition={reduce ? { duration: 0 } : { duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Slow sweep ring — pauses under reduced motion */}
        {!reduce && (
          <motion.g
            style={{ originX: '80px', originY: '80px' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
          >
            <circle
              cx="80"
              cy="80"
              r="62"
              stroke="rgba(255,79,32,0.2)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="4 28"
            />
          </motion.g>
        )}

        <circle cx="80" cy="80" r="34" stroke="rgba(255,79,32,0.4)" strokeWidth="2" fill="rgba(255,79,32,0.06)" />
        <motion.circle
          cx="80"
          cy="80"
          r="8"
          fill="#FF4F20"
          animate={reduce ? undefined : { scale: [1, 1.12, 1] }}
          transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '80px 80px' }}
        />

        <motion.g
          initial={false}
          animate={{ rotate: tickAngle }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 18 }}
          style={{ originX: '80px', originY: '80px' }}
        >
          <line x1="80" y1="80" x2="80" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="80" cy="24" r="4.5" fill={color} />
        </motion.g>
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}
      >
        {!hasData
          ? 'Awaiting flow data'
          : `${positive ? '+' : '−'}$${(Math.abs(net) / 1e6).toFixed(0)}M net ETF`}
      </div>
    </div>
  );
}
