'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Prices { btc: number; eth: number; sol: number; bnb: number; }

export default function DashboardPage() {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/prices')
      .then(async r => {
        if (!r.ok) throw new Error('Live market data unavailable');
        return r.json() as Promise<Prices>;
      })
      .then(d => { setPrices(d); setError(''); })
      .catch(e => setError(e instanceof Error ? e.message : 'Live market data unavailable'));
  }, []);

  const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const cards = [
    { label: 'BTC/USDT', value: prices ? `$${fmt(prices.btc, 0)}` : '--', sub: 'Live', pos: true },
    { label: 'ETH/USDT', value: prices ? `$${fmt(prices.eth, 0)}` : '--', sub: 'Live', pos: true },
    { label: 'SOL/USDT', value: prices ? `$${fmt(prices.sol, 2)}` : '--', sub: 'Live', pos: true },
    { label: 'BNB/USDT', value: prices ? `$${fmt(prices.bnb, 0)}` : '--', sub: 'Live', pos: true },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: '#444', marginBottom: 24 }}>Smart Money Research Engine — Live Overview</p>

      {error && <div style={{ marginBottom: 18, color: '#f43f5e', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 6, fontWeight: 600 }}>
              {c.pos ? '▲' : '▼'} {c.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { href: '/breaking-news',  label: 'Breaking News',  color: '#3b82f6', icon: '📰', desc: 'Real-time market alpha' },
          { href: '/ai-analysis',    label: 'AI Analysis',    color: '#f97316', icon: '🤖', desc: 'Gemini + Groq signals' },
          { href: '/ai-trade-agent', label: 'Trade Agent',    color: '#00e676', icon: '💱', desc: 'Execute paper trades' },
          { href: '/etf-dashboard',  label: 'ETF Dashboard',  color: '#a855f7', icon: '📊', desc: 'US Spot ETF flows' },
          { href: '/portfolio',      label: 'Portfolio',      color: '#f59e0b', icon: '💼', desc: 'PnL & holdings tracker' },
          { href: '/guidelines',     label: 'Guidelines',     color: '#6b7280', icon: '📋', desc: 'Platform rules' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: `${item.color}10`, border: `1px solid ${item.color}25`, borderRadius: 12, textDecoration: 'none', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${item.color}55`}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = `${item.color}25`}>
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
