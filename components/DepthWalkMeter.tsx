'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { walkDepth, type WalkLevel } from '@/lib/depth-walk';

function fmt(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/**
 * Pre-signature depth meter. Draws each visible level on the side the order
 * would take, filled by the share this order consumes. Estimates only; the
 * venue fills against the book at the moment it receives the signed order.
 */
export function DepthWalkMeter({
  side,
  type,
  size,
  limitPrice,
  bids,
  asks,
  quoteAsset = 'USDC',
}: {
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  size: number;
  limitPrice: number | null;
  bids: WalkLevel[];
  asks: WalkLevel[];
  quoteAsset?: string;
}) {
  const reduce = useReducedMotion();
  const walk = walkDepth({ side, type, size, limitPrice, bids, asks });
  const hasBook = (side === 'buy' ? asks : bids).length > 0;

  if (!hasBook) {
    return (
      <div className="walk walk-empty" role="status">
        <strong>No live depth</strong>
        <p>The SoDEX mainnet book did not load, so slippage is not estimated. Nothing here is a sample.</p>
      </div>
    );
  }
  if (!(size > 0)) {
    return (
      <div className="walk walk-empty" role="status">
        <strong>Enter a size</strong>
        <p>The meter shows which live levels your order would take before you sign.</p>
      </div>
    );
  }

  const quoteMode = type === 'market' && side === 'buy';
  const slip = walk.slippageBps;
  const tone = slip == null ? 'muted' : slip < 5 ? 'calm' : slip < 25 ? 'watch' : 'hot';

  return (
    <div className="walk" aria-label="Depth walk estimate">
      <dl className="walk-stats">
        <div>
          <dt>Avg fill</dt>
          <dd className="tabular">{fmt(walk.averagePrice, 4)}</dd>
        </div>
        <div>
          <dt>Slippage vs touch</dt>
          <dd className={`tabular walk-${tone}`}>{slip == null ? '—' : `${slip.toFixed(2)} bps`}</dd>
        </div>
        <div>
          <dt>{side === 'buy' ? 'You pay' : 'You receive'}</dt>
          <dd className="tabular">
            {fmt(walk.quoteUsed, 2)} {quoteAsset}
          </dd>
        </div>
      </dl>
      <ol className="walk-rows">
        {walk.rows.map((row, i) => (
          <li key={row.price} className="walk-row" data-taken={row.taken > 0 ? 'true' : 'false'}>
            <span className="tabular walk-price">{fmt(row.price, 4)}</span>
            <span className="walk-track" aria-hidden>
              <motion.span
                className={`walk-fill walk-${side}`}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: Math.min(1, row.share) }}
                transition={reduce ? { duration: 0 } : { duration: 0.32, delay: Math.min(i * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
            <span className="tabular walk-away">+{row.awayBps.toFixed(1)} bps</span>
          </li>
        ))}
      </ol>
      <p className="execution-meta" role="status">
        {walk.complete
          ? `Visible depth covers the order across ${walk.rows.filter((r) => r.taken > 0).length} level(s).`
          : type === 'limit'
            ? `${fmt(walk.remainder, 6)} would rest on the book at your limit; it may never fill.`
            : `The levels shown do not cover ${fmt(walk.remainder, 6)}${quoteMode ? ` ${quoteAsset}` : ''} of your size. Deeper levels could fill it at a worse price, or it could fill partly.`}{' '}
        Estimate from the live book; the venue decides the real fill.
      </p>
    </div>
  );
}
