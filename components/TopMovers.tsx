'use client';
import { useEffect, useState } from 'react';

interface Mover {
  symbol: string;
  price: string;
  change: string;
}

export default function TopMovers() {
  const [movers, setMovers] = useState<Mover[]>([]);

  useEffect(() => {
    fetch('/api/prices')
      .then(r => r.json())
      .then(d => {
        if (d.prices) {
          const sorted = [...d.prices].sort((a, b) => Math.abs(parseFloat(b.change)) - Math.abs(parseFloat(a.change)));
          setMovers(sorted.slice(0, 4));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 20, height: '100%' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em', marginBottom: 16 }}>TOP VOLATILITY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {movers.map(m => (
          <div key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: 'var(--text-primary)' }}>
                {m.symbol.replace('USDT', '')[0]}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{m.symbol.replace('USDT', '')}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: parseFloat(m.change) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {parseFloat(m.change) >= 0 ? '+' : ''}{m.change}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>${parseFloat(m.price).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
