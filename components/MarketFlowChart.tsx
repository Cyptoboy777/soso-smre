'use client';
import { motion } from 'framer-motion';

export default function MarketFlowChart() {
  const nodes = [
    { id: 'stables', label: 'STABLECOINS', color: '#00e676', x: 50, y: 150 },
    { id: 'btc', label: 'BITCOIN', color: '#f7931a', x: 300, y: 70 },
    { id: 'eth', label: 'ETHEREUM', color: '#627eea', x: 300, y: 230 },
    { id: 'alts', label: 'ALTCOINS', color: '#a855f7', x: 550, y: 150 },
  ];

  const paths = [
    { from: 'stables', to: 'btc', label: 'Liquidity Inflow', color: '#f7931a' },
    { from: 'stables', to: 'eth', label: 'Capital Flow', color: '#627eea' },
    { from: 'btc', to: 'alts', label: 'Risk Rotation', color: '#a855f7' },
    { from: 'eth', to: 'alts', label: 'Yield Seeking', color: '#a855f7' },
  ];

  return (
    <div style={{ padding: 24, background: '#0a0a0a', borderRadius: 20, border: '1px solid #1a1a1a', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
         <h3 style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-dim)', letterSpacing: '.12em' }}>CAPITAL ROTATION FLOW</h3>
         <span style={{ fontSize: 9, color: 'var(--accent-orange)', fontWeight: 800 }}>LIVE ANALYSIS</span>
      </div>

      <svg width="600" height="300" viewBox="0 0 600 300" style={{ width: '100%', height: 'auto' }}>
        {/* Animated Paths */}
        {paths.map((p, i) => {
          const from = nodes.find(n => n.id === p.from)!;
          const to = nodes.find(n => n.id === p.to)!;
          return (
            <g key={i}>
              <motion.path
                d={`M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`}
                stroke={p.color}
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0, opacity: 0.2 }}
                animate={{ pathLength: 1, opacity: 0.5 }}
                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
              />
              <motion.circle
                r="3"
                fill={p.color}
                animate={{
                  offsetDistance: ['0%', '100%'],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: i * 0.5 }}
                style={{ offsetPath: `path("M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}")` }}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(n => (
          <g key={n.id}>
            <motion.circle
              cx={n.x}
              cy={n.y}
              r="6"
              fill={n.color}
              animate={{ r: [6, 10, 6], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <text
              x={n.x}
              y={n.y + 24}
              textAnchor="middle"
              fill="var(--text-dim)"
              style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em' }}
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
         <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.1)', padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: '#00e676', fontWeight: 800 }}>STABLECOIN DOMINANCE</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>14.2% <span style={{ fontSize: 10, color: '#f43f5e' }}>↘</span></div>
         </div>
         <div style={{ background: 'rgba(247,147,26,0.05)', border: '1px solid rgba(247,147,26,0.1)', padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: '#f7931a', fontWeight: 800 }}>BTC DOMINANCE</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>58.4% <span style={{ fontSize: 10, color: '#00e676' }}>↗</span></div>
         </div>
      </div>
    </div>
  );
}
