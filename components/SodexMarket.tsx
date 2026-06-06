'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, TrendingDown, Zap, BarChart2, BookOpen, Terminal, RefreshCw } from 'lucide-react';
import { fmtPrice, fmtPct } from '@/lib/sodex';
import type { Ticker, OrderBook as OB, Network } from '@/types/sodex';
import { useSodexStore } from '@/store/sodexStore';
import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  MARKET TICKER SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
export function MarketTicker({
  tickers, onSelect, selected, sortMode,
}: { tickers: Ticker[]; onSelect: (t: Ticker) => void; selected?: string; sortMode: 'vol' | 'gainers' | 'losers' }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = tickers.filter(
      t => t.symbol.toLowerCase().includes(search.toLowerCase()) ||
           t.base.toLowerCase().includes(search.toLowerCase())
    );
    if (sortMode === 'gainers') list.sort((a, b) => b.priceChangePct - a.priceChangePct);
    else if (sortMode === 'losers') list.sort((a, b) => a.priceChangePct - b.priceChangePct);
    else list.sort((a, b) => b.quoteVolume - a.quoteVolume);
    return list;
  }, [tickers, search, sortMode]);

  const gainersCount = tickers.filter(t => t.priceChangePct > 0).length;
  const losersCount  = tickers.filter(t => t.priceChangePct < 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)' }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <BarChart2 size={13} color="var(--accent-orange)" />
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Markets</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-dim)' }}>
            <span style={{ color: '#00e676', fontWeight: 800 }}>{gainersCount}↑</span>
            {' · '}
            <span style={{ color: '#f43f5e', fontWeight: 800 }}>{losersCount}↓</span>
          </span>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pair…"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-bold)', borderRadius: 8,
              padding: '7px 10px 7px 28px', fontSize: 12, color: 'var(--text-primary)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '6px 14px', fontSize: 8, color: 'var(--text-dim)', fontWeight: 900, letterSpacing: '0.12em', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
        <span>PAIR</span>
        <span style={{ textAlign: 'right' }}>PRICE</span>
        <span style={{ textAlign: 'right', marginLeft: 14 }}>24H</span>
      </div>

      {/* List */}
      <div className="scroll-track" style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>No pairs found</div>
        ) : filtered.map(t => {
          const isUp     = t.priceChangePct >= 0;
          const isActive = t.symbol === selected;
          const absPct   = Math.abs(t.priceChangePct);
          const hot      = absPct > 5;

          return (
            <div
              key={t.symbol}
              onClick={() => onSelect(t)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
                background: isActive ? 'rgba(249,115,22,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent-orange)' : '2px solid transparent',
              }}
            >
              {/* Hot glow */}
              {hot && <div style={{ position: 'absolute', inset: 0, background: isUp ? 'rgba(0,230,118,0.03)' : 'rgba(244,63,94,0.03)', pointerEvents: 'none' }} />}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: isActive ? 'var(--accent-orange)' : 'var(--text-primary)' }}>{t.base}</span>
                  {hot && <span style={{ fontSize: 7, fontWeight: 900, color: isUp ? '#00e676' : '#f43f5e', background: isUp ? 'rgba(0,230,118,0.12)' : 'rgba(244,63,94,0.12)', padding: '1px 5px', borderRadius: 4 }}>🔥</span>}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>/USDC</div>
              </div>

              <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>${fmtPrice(t.lastPrice)}</div>
              </div>

              <div style={{ textAlign: 'right', marginLeft: 12, alignSelf: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color: isUp ? '#00e676' : '#f43f5e' }}>
                  {isUp ? '▲' : '▼'}{absPct.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ORDER BOOK
// ─────────────────────────────────────────────────────────────────────────────
export const OrderBook = React.memo(function OrderBook({ symbol }: { symbol: string | null }) {
  const book = useSodexStore(state => state.orderBook);

  if (!symbol || !book) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 12, flexDirection: 'column', gap: 8, opacity: 0.5 }}>
      <BookOpen size={20} />
      <span>Select a pair</span>
    </div>
  );

  const asks   = book.asks.slice(0, 12);
  const bids   = book.bids.slice(0, 12);
  const allQty = [...asks, ...bids].map(o => o.qty);
  const maxQty = Math.max(...allQty, 1);
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : 0;
  const spreadPct = bids[0] ? (spread / bids[0].price * 100).toFixed(3) : '0';

  const Row = ({ p, q, side }: { p: number; q: number; side: 'bid' | 'ask' }) => {
    const pct = Math.min((q / maxQty) * 100, 100);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '3px 14px', fontSize: 11, fontFamily: 'monospace', position: 'relative', gap: 4 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, [side === 'bid' ? 'left' : 'right']: 0, width: `${pct}%`, background: side === 'bid' ? 'rgba(0,230,118,0.07)' : 'rgba(244,63,94,0.07)', transition: 'width 0.3s' }} />
        <span style={{ color: side === 'bid' ? '#00e676' : '#f43f5e', position: 'relative', fontWeight: 700 }}>{fmtPrice(p)}</span>
        <span style={{ color: 'var(--text-dim)', position: 'relative', textAlign: 'right' }}>{q.toFixed(4)}</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Column header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '6px 14px', fontSize: 8, color: 'var(--text-dim)', fontWeight: 900, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
        <span>PRICE (USDC)</span>
        <span style={{ textAlign: 'right' }}>SIZE</span>
      </div>

      <div className="scroll-track" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Asks (sell side — red, reversed) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {[...asks].reverse().map((a, i) => <Row key={i} p={a.price} q={a.qty} side="ask" />)}
        </div>

        {/* Spread row */}
        <div style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: '#fff' }}>${fmtPrice(bids[0]?.price || 0)}</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800 }}>SPREAD {spreadPct}%</span>
        </div>

        {/* Bids (buy side — green) */}
        <div style={{ flex: 1 }}>
          {bids.map((b, i) => <Row key={i} p={b.price} q={b.qty} side="bid" />)}
        </div>
      </div>

      {/* Bid/Ask depth bar */}
      {bids.length > 0 && asks.length > 0 && (() => {
        const totalBid = bids.reduce((s, b) => s + b.qty, 0);
        const totalAsk = asks.reduce((s, a) => s + a.qty, 0);
        const bidPct   = Math.round(totalBid / (totalBid + totalAsk) * 100);
        return (
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, fontWeight: 900, marginBottom: 4, color: 'var(--text-dim)' }}>
              <span style={{ color: '#00e676' }}>BIDS {bidPct}%</span>
              <span style={{ color: '#f43f5e' }}>ASKS {100 - bidPct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(244,63,94,0.4)', overflow: 'hidden' }}>
              <div style={{ width: `${bidPct}%`, height: '100%', background: '#00e676', transition: 'width 0.5s', borderRadius: 2 }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  COPY TRADE PANEL (unchanged interface, improved UI)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_TRADERS = [
  { rank: 1, address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', roi: 1250.4, trades: 142, winRate: 88, vol: '2.4M' },
  { rank: 2, address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', roi: 980.2, trades: 89, winRate: 76, vol: '1.1M' },
  { rank: 3, address: '0x1234567890abcdef1234567890abcdef12345678', roi: 840.5, trades: 210, winRate: 65, vol: '4.2M' },
  { rank: 4, address: '0xDEAFBEEF00000000000000000000000000000000', roi: 720.1, trades: 56, winRate: 92, vol: '800K' },
  { rank: 5, address: '0x5555555555555555555555555555555555555555', roi: 610.8, trades: 120, winRate: 71, vol: '1.5M' },
].concat(Array.from({ length: 15 }, (_, i) => ({
  rank: i + 6,
  address: `0x${Math.random().toString(16).slice(2, 42)}`,
  roi: 500 - (i * 25) + (Math.random() * 10),
  trades: Math.floor(Math.random() * 100) + 20,
  winRate: Math.floor(Math.random() * 30) + 50,
  vol: (Math.random() * 500).toFixed(1) + 'K',
})));

import { useCopyTrade } from '@/hooks/useCopyTrade';

export function CopyTradePanel({ network }: { network: Network }) {
  const [address,   setAddress]   = useState('');
  const [multi,     setMulti]     = useState(1.0);
  const [active,    setActive]    = useState(false);
  const [timeframe, setTimeframe] = useState<'24h' | '1w' | '1m' | 'all'>('24h');

  const { logs, watching, stop } = useCopyTrade(
    active && address ? { targetAddress: address, sizeMultiplier: multi, onlyBuys: false, onlySells: false, maxOrderUSDC: 500, network } : null
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Controls */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 900, letterSpacing: '.12em', marginBottom: 6, textTransform: 'uppercase' }}>Target Wallet</div>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x…" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-bold)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#fff', outline: 'none', fontFamily: 'monospace', marginBottom: 10, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, marginBottom: 5 }}>MULTIPLIER</div>
            <input type="number" value={multi} onChange={e => setMulti(parseFloat(e.target.value))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-bold)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={() => { if (active) stop(); setActive(!active); }} style={{ flex: 1, marginTop: 15, borderRadius: 8, border: 'none', background: active ? 'linear-gradient(135deg,#f43f5e,#be123c)' : 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontSize: 10, fontWeight: 900, cursor: 'pointer', letterSpacing: '.08em' }}>
            {active ? '■ STOP' : '▶ START COPY'}
          </button>
        </div>
      </div>

      {/* Timeframe tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
        {(['24h', '1w', '1m', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTimeframe(t)} style={{ flex: 1, padding: '9px 0', border: 'none', background: 'transparent', color: timeframe === t ? 'var(--accent-orange)' : 'var(--text-dim)', fontSize: 9, fontWeight: 900, cursor: 'pointer', borderBottom: timeframe === t ? '2px solid var(--accent-orange)' : '2px solid transparent', letterSpacing: '.08em' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Leaderboard header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', fontSize: 8, color: 'var(--text-dim)', fontWeight: 900, letterSpacing: '.1em', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)', flexShrink: 0 }}>
        <span>TRADER</span>
        <span>ROI · WIN · TRADES</span>
      </div>

      {/* List */}
      <div className="scroll-track" style={{ flex: 1, overflowY: 'auto' }}>
        {MOCK_TRADERS.map(trader => (
          <div
            key={trader.address}
            onClick={() => setAddress(trader.address)}
            style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: address === trader.address ? 'rgba(249,115,22,0.06)' : 'transparent', transition: 'background 0.2s' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                  <span style={{ color: trader.rank <= 3 ? 'var(--accent-orange)' : 'var(--text-dim)', marginRight: 6 }}>#{trader.rank}</span>
                  {trader.address.slice(0, 6)}…{trader.address.slice(-4)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  Win: <span style={{ color: '#00e676' }}>{trader.winRate}%</span> · {trader.trades} trades · Vol: {trader.vol}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#00e676', fontFamily: 'monospace' }}>+{trader.roi.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Execution log */}
      {logs.length > 0 && (
        <div style={{ height: 100, background: 'var(--bg-main)', borderTop: '2px solid var(--border-bold)', padding: 10, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', fontWeight: 900, marginBottom: 4, letterSpacing: '.1em' }}>EXECUTION LOG</div>
          {logs.map(log => <div key={log.id} style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: 2 }}>[{new Date(log.ts).toLocaleTimeString()}] {log.message}</div>)}
        </div>
      )}
    </div>
  );
}
