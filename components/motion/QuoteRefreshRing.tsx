'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { SWAP_QUOTE_POLL_MS } from '@/lib/swap-ux';

export default function QuoteRefreshRing({
  intervalMs = SWAP_QUOTE_POLL_MS,
  updatedAt,
  refreshing,
  onRefresh,
  disabled,
}: {
  intervalMs?: number;
  updatedAt: number;
  refreshing?: boolean;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (reduce) return;
    let id = 0;
    const tick = () => {
      if (typeof document === 'undefined' || !document.hidden) setNow(Date.now());
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    const onVis = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(id); document.removeEventListener('visibilitychange', onVis); };
  }, [reduce]);

  const elapsed = updatedAt > 0 ? Math.max(0, now - updatedAt) : 0;
  const remainMs = updatedAt > 0 ? Math.max(0, intervalMs - elapsed) : intervalMs;
  const progress = intervalMs > 0 && updatedAt > 0 ? Math.min(1, elapsed / intervalMs) : 0;
  const size = 22;
  const r = 8;
  const c = 2 * Math.PI * r;
  const seconds = Math.max(0, remainMs / 1000);
  const label = refreshing
    ? 'Refreshing the quote now'
    : updatedAt
      ? `Quote refreshes in ${seconds < 1 ? seconds.toFixed(1) : Math.ceil(seconds)}s. Tap to refresh now.`
      : 'Tap to refresh the quote now.';

  return (
    <button
      type="button"
      className="ss-quote-ring"
      onClick={() => { if (!disabled && !refreshing) onRefresh(); }}
      disabled={disabled || refreshing}
      aria-label={label}
      title={label}
    >
      <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden className={refreshing ? 'ss-quote-ring-spin' : undefined}>
        <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeWidth="2" className="ss-quote-ring-track" />
        <circle
          cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeWidth="2.2"
          className="ss-quote-ring-prog"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (reduce ? 0.25 : progress)}
          transform="rotate(-90 11 11)"
        />
      </svg>
      <RefreshCw className="ss-quote-ring-ico" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
