'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MarketTicker } from '@/types/flow';
import { formatPair, formatPct, formatPrice, formatVolume } from '@/lib/display';

type Props = {
  value: string;
  onChange: (symbol: string) => void;
};

export function PairSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/sodex/market?list=tickers', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { tickers?: MarketTicker[] };
        if (!alive) return;
        setTickers(json.tickers ?? []);
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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = !needle
      ? tickers
      : tickers.filter(
          (t) =>
            formatPair(t.symbol).toLowerCase().includes(needle) ||
            t.symbol.toLowerCase().includes(needle),
        );
    return list.slice(0, 50);
  }, [tickers, q]);

  useEffect(() => setActive(0), [q, open]);

  const current = tickers.find((t) => t.symbol === value);

  function choose(sym: string) {
    onChange(sym);
    setOpen(false);
    setQ('');
  }

  return (
    <div className={`pair-selector ${open ? 'is-open' : ''}`} ref={rootRef}>
      {open ? (
        <button
          type="button"
          className="pair-palette-backdrop"
          aria-label="Close pair list"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <button
        type="button"
        className="pair-selector-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="pair-name">{formatPair(value)}</span>
        <span className="pair-meta">
          {current ? (
            <>
              <span className="tabular">{formatPrice(current.lastPrice)}</span>
              <span className={current.changePct24h >= 0 ? 'up' : 'down'}>{formatPct(current.changePct24h)}</span>
            </>
          ) : (
            <span>Select pair</span>
          )}
        </span>
      </button>
      {open ? (
        <div className="pair-palette" role="listbox" aria-label="Select market pair">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search BTC, ETH, SOL…"
            aria-label="Search pairs"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && filtered[active]) {
                e.preventDefault();
                choose(filtered[active]!.symbol);
              }
            }}
          />
          <div className="pair-palette-head tabular" aria-hidden>
            <span>Pair</span>
            <span>Price</span>
            <span>24h</span>
            <span>Vol</span>
          </div>
          <div className="pair-palette-list">
            {filtered.map((t, i) => (
              <button
                key={t.symbol}
                type="button"
                role="option"
                aria-selected={t.symbol === value}
                className={`pair-option ${t.symbol === value ? 'is-active' : ''} ${i === active ? 'is-kb' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(t.symbol)}
              >
                <span className="pair">{formatPair(t.symbol)}</span>
                <span className="tabular price">{formatPrice(t.lastPrice)}</span>
                <span className={`tabular ch ${t.changePct24h >= 0 ? 'up' : 'down'}`}>{formatPct(t.changePct24h)}</span>
                <span className="tabular vol">{formatVolume(t.volume)}</span>
              </button>
            ))}
            {!filtered.length ? <p className="muted">No pairs match.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
