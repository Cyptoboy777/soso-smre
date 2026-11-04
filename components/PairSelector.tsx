'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MarketTicker } from '@/types/flow';

type Props = {
  value: string;
  onChange: (symbol: string) => void;
};

function pretty(sym: string) {
  return sym.replace(/^v/, '').replace(/_v/, '/').replace(/_/g, '/');
}

export function PairSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [gateway, setGateway] = useState<string>('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/sodex/market?list=tickers', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { tickers?: MarketTicker[]; gateway?: string };
        if (!alive) return;
        setTickers(json.tickers ?? []);
        setGateway(json.gateway ?? '');
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, 8000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tickers.slice(0, 40);
    return tickers.filter((t) => pretty(t.symbol).toLowerCase().includes(needle) || t.symbol.toLowerCase().includes(needle)).slice(0, 40);
  }, [tickers, q]);

  const current = tickers.find((t) => t.symbol === value);

  return (
    <div className="pair-selector">
      <button type="button" className="pair-selector-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="pair-name">{pretty(value)}</span>
        <span className="pair-meta">
          {current ? (
            <>
              <span className="tabular">{current.lastPrice.toLocaleString()}</span>
              <span className={current.changePct24h >= 0 ? 'up' : 'down'}>
                {current.changePct24h >= 0 ? '+' : ''}
                {current.changePct24h.toFixed(2)}%
              </span>
            </>
          ) : (
            <span>Live prices</span>
          )}
        </span>
      </button>
      {open ? (
        <div className="pair-selector-pop" role="listbox">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search BTC, ETH, SOL…"
            aria-label="Search pairs"
            autoFocus
          />
          <div className="pair-selector-list">
            {filtered.map((t) => (
              <button
                key={t.symbol}
                type="button"
                className={`pair-option ${t.symbol === value ? 'is-active' : ''}`}
                onClick={() => {
                  onChange(t.symbol);
                  setOpen(false);
                  setQ('');
                }}
              >
                <span>{pretty(t.symbol)}</span>
                <span className="tabular">{t.lastPrice.toLocaleString()}</span>
                <span className={t.changePct24h >= 0 ? 'up' : 'down'}>
                  {t.changePct24h >= 0 ? '+' : ''}
                  {t.changePct24h.toFixed(2)}%
                </span>
                <span className="vol tabular">{Math.round(t.volume).toLocaleString()}</span>
              </button>
            ))}
            {!filtered.length ? <p className="muted">No pairs match.</p> : null}
          </div>
          <p className="pair-footnote">Live prices{gateway ? ` · ${gateway}` : ''} · Practice mode for orders</p>
        </div>
      ) : null}
    </div>
  );
}
