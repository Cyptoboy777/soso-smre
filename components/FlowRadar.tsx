'use client';

/** Signature: sentinel aperture that opens with ETF net-flow magnitude. */
export function FlowRadar({
  btcInflow,
  ethInflow,
  size = 160,
}: {
  btcInflow: number | null;
  ethInflow: number | null;
  size?: number;
}) {
  const net = (btcInflow ?? 0) + (ethInflow ?? 0);
  const mag = Math.min(1, Math.abs(net) / 400_000_000);
  const open = 40 + mag * 100; // degrees of gap
  const positive = net >= 0;
  const color = positive ? 'var(--success)' : 'var(--danger)';
  const tickAngle = positive ? -45 : 135;

  return (
    <div
      aria-hidden
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
          <linearGradient id="fr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--flame-500)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--flame-400)" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
        <circle
          cx="80"
          cy="80"
          r="54"
          stroke="url(#fr)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(360 - open) * 0.942} ${open * 0.942}`}
          transform={`rotate(-90 80 80)`}
          style={{ transition: 'stroke-dasharray 600ms var(--ease-out)' }}
        />
        <circle
          cx="80"
          cy="80"
          r="34"
          stroke="rgba(255,79,32,0.35)"
          strokeWidth="2"
          fill="rgba(255,79,32,0.05)"
        />
        <circle cx="80" cy="80" r="8" fill="var(--accent)" />
        <g transform={`rotate(${tickAngle} 80 80)`}>
          <line x1="80" y1="80" x2="80" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="80" cy="26" r="4" fill={color} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em',
        }}
      >
        {btcInflow == null && ethInflow == null
          ? 'no flow data'
          : `${positive ? '+' : '−'}$${(Math.abs(net) / 1e6).toFixed(0)}M net`}
      </div>
    </div>
  );
}
