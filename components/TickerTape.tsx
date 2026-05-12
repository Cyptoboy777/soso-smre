'use client';
import { useEffect, useRef, useState } from 'react';

const TICKERS = [
  { symbol: 'BTC', id: 'bitcoin' },
  { symbol: 'ETH', id: 'ethereum' },
  { symbol: 'SOL', id: 'solana' },
  { symbol: 'BNB', id: 'binancecoin' },
  { symbol: 'XRP', id: 'ripple' },
  { symbol: 'DOGE', id: 'dogecoin' },
  { symbol: 'ADA', id: 'cardano' },
  { symbol: 'AVAX', id: 'avalanche-2' },
  { symbol: 'LINK', id: 'chainlink' },
  { symbol: 'DOT', id: 'polkadot' },
];

interface Price { usd: number; usd_24h_change: number; }

export default function TickerTape() {
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const ids = TICKERS.map(t => t.id).join(',');
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        if (res.ok) setPrices(await res.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const items = TICKERS.map(t => {
    const p = prices[t.id];
    const price = p ? `$${p.usd.toLocaleString('en-US', { maximumFractionDigits: p.usd > 100 ? 0 : 4 })}` : '---';
    const change = p ? p.usd_24h_change : 0;
    const up = change >= 0;
    return { ...t, price, change, up };
  });

  // Duplicate for seamless loop
  const display = [...items, ...items];

  return (
    <div style={{
      height: 28,
      background: 'rgba(0,0,0,0.6)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          align-items: center;
          height: 100%;
          width: max-content;
          animation: tickerScroll 40s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover { animation-play-state: paused; }
        .ticker-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 20px;
          border-right: 1px solid rgba(255,255,255,0.05);
          white-space: nowrap;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .04em;
          font-family: 'Inter', monospace;
        }
      `}} />
      <div className="ticker-track" ref={ref}>
        {display.map((item, i) => (
          <div className="ticker-item" key={`${item.symbol}-${i}`}>
            <span style={{ color: '#94a3b8' }}>{item.symbol}</span>
            <span style={{ color: '#fff' }}>{item.price}</span>
            <span style={{ color: item.up ? '#00e676' : '#f43f5e' }}>
              {item.up ? '▲' : '▼'} {Math.abs(item.change).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
