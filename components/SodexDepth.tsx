'use client';

import type { SodexOrderBook } from '@/types/flow';

export function SodexDepth({ book, height = 180 }: { book: SodexOrderBook | null; height?: number }) {
  if (!book || (!book.bids.length && !book.asks.length)) {
    return (
      <div className="muted" style={{ height, display: 'grid', placeItems: 'center', fontSize: 13 }}>
        Depth unavailable
      </div>
    );
  }
  const bids = book.bids.slice(0, 12);
  const asks = book.asks.slice(0, 12);
  const maxQty = Math.max(...bids.map((b) => b.qty), ...asks.map((a) => a.qty), 1e-9);
  return (
    <div className="sodex-depth" style={{ height, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} aria-label="SoDEX order book">
      <div>
        <div className="sodex-depth-h">Bids</div>
        {bids.map((l) => (
          <div key={`b-${l.price}`} className="sodex-depth-row bid">
            <div className="sodex-depth-bar" style={{ width: `${(l.qty / maxQty) * 100}%` }} />
            <span>{l.price.toLocaleString()}</span>
            <span>{l.qty}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="sodex-depth-h">Asks</div>
        {asks.map((l) => (
          <div key={`a-${l.price}`} className="sodex-depth-row ask">
            <div className="sodex-depth-bar" style={{ width: `${(l.qty / maxQty) * 100}%` }} />
            <span>{l.price.toLocaleString()}</span>
            <span>{l.qty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
