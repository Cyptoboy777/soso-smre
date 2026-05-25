'use client';
import { useEffect, useRef, useState } from 'react';

interface PriceItem {
  symbol: string;
  price: string;
  change: string;
  rawPrice: number;
}

export default function TickerTape() {
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/prices');
        if (!res.ok) return;
        const data = await res.json();
        const items: PriceItem[] = (data.prices ?? [])
          .filter((p: PriceItem) => p.rawPrice > 0) // skip zero prices
          .slice(0, 15);
        if (items.length > 0) {
          setPrices(items);
          setLoading(false);
        }
      } catch {}
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, []);

  const display = [...prices, ...prices]; // duplicate for seamless loop

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
          animation: tickerScroll 50s linear infinite;
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

      {loading ? (
        // Loading skeleton
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: 20, gap: 30 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 28, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
              <div style={{ width: 50, height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="ticker-track">
          {display.map((item, i) => {
            const change = parseFloat(item.change);
            const up = change >= 0;
            // Format price properly
            const rawP = item.rawPrice;
            const priceStr = rawP >= 1000
              ? `$${rawP.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : rawP >= 1
              ? `$${rawP.toFixed(2)}`
              : `$${rawP.toFixed(4)}`;

            const sym = item.symbol.replace('USDT', '');

            return (
              <div className="ticker-item" key={`${item.symbol}-${i}`}>
                <span style={{ color: '#94a3b8' }}>{sym}</span>
                <span style={{ color: '#fff' }}>{priceStr}</span>
                <span style={{ color: up ? '#00e676' : '#f43f5e' }}>
                  {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
