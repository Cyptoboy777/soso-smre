'use client';

import type { SodexOrderBook } from '@/types/flow';

function fmtPx(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

function fmtQty(n: number) {
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

export function SodexDepth({ book, height = 280 }: { book: SodexOrderBook | null; height?: number }) {
  if (!book || (!book.bids.length && !book.asks.length)) {
    return (
      <div className="muted" style={{ height, display: 'grid', placeItems: 'center', fontSize: 13 }}>
        Depth unavailable
      </div>
    );
  }
  // Standard ladder: asks ascending toward spread (worst ask at top, best ask just above spread)
  const asksDown = [...book.asks].slice(0, 10).sort((a, b) => b.price - a.price);
  const bids = [...book.bids].slice(0, 10).sort((a, b) => b.price - a.price);
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asksDown[asksDown.length - 1]?.price ?? book.asks[0]?.price ?? 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const mid = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : 0;
  const maxQty = Math.max(...bids.map((b) => b.qty), ...asksDown.map((a) => a.qty), 1e-9);

  return (
    <div className="sodex-ladder" style={{ height }} aria-label="Live order book">
      <div className="sodex-ladder-head">
        <span>Price</span>
        <span>Size</span>
      </div>
      <div className="sodex-ladder-asks">
        {asksDown.map((l) => (
          <div key={`a-${l.price}`} className="sodex-ladder-row ask">
            <div className="sodex-ladder-bar" style={{ width: `${(l.qty / maxQty) * 100}%` }} />
            <span className="px tabular">{fmtPx(l.price)}</span>
            <span className="qty tabular">{fmtQty(l.qty)}</span>
          </div>
        ))}
      </div>
      <div className="sodex-ladder-spread tabular">
        <span>Spread {fmtPx(spread)}</span>
        <span>Mid {fmtPx(mid)}</span>
      </div>
      <div className="sodex-ladder-bids">
        {bids.map((l) => (
          <div key={`b-${l.price}`} className="sodex-ladder-row bid">
            <div className="sodex-ladder-bar" style={{ width: `${(l.qty / maxQty) * 100}%` }} />
            <span className="px tabular">{fmtPx(l.price)}</span>
            <span className="qty tabular">{fmtQty(l.qty)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
