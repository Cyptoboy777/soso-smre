'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Zap, AlertTriangle } from 'lucide-react';
import type { Ticker } from '@/types/sodex';

// ── Mini stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'12px 16px', display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
      <div style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:900, color: color ?? '#fff', fontFamily:'var(--font-mono)', letterSpacing:'-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'var(--text-dim)', fontWeight:700 }}>{sub}</div>}
    </div>
  );
}

// ── Heatmap tile ──────────────────────────────────────────────────────────
function HeatTile({ ticker, onSelect, isSelected }: { ticker: Ticker; onSelect: (t: Ticker) => void; isSelected: boolean }) {
  const pct = ticker.priceChangePct;
  const abs  = Math.abs(pct);

  const bg = pct > 8  ? 'rgba(0,230,118,0.55)'
           : pct > 4  ? 'rgba(0,230,118,0.35)'
           : pct > 1  ? 'rgba(0,230,118,0.18)'
           : pct > 0  ? 'rgba(0,230,118,0.09)'
           : pct > -1 ? 'rgba(244,63,94,0.09)'
           : pct > -4 ? 'rgba(244,63,94,0.18)'
           : pct > -8 ? 'rgba(244,63,94,0.35)'
           :             'rgba(244,63,94,0.55)';

  const textColor = pct >= 0 ? '#00e676' : '#f43f5e';
  // Size tile by volume weight (rough visual sizing)
  const size = ticker.quoteVolume > 1_000_000 ? 'large' : ticker.quoteVolume > 100_000 ? 'medium' : 'small';
  const pad  = size === 'large' ? '14px 16px' : size === 'medium' ? '10px 12px' : '7px 10px';
  const fontSize = size === 'large' ? 14 : size === 'medium' ? 12 : 10;

  return (
    <motion.div
      whileHover={{ scale:1.04, zIndex:10 }}
      whileTap={{ scale:0.97 }}
      onClick={() => onSelect(ticker)}
      style={{ background:bg, border:`1.5px solid ${isSelected ? textColor : 'rgba(255,255,255,0.06)'}`, borderRadius:10, padding:pad, cursor:'pointer', display:'flex', flexDirection:'column', gap:2, boxShadow: isSelected ? `0 0 16px ${textColor}40` : 'none', transition:'border-color 0.2s', minWidth:0 }}
      title={`${ticker.base}: $${ticker.lastPrice.toLocaleString()} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`}
    >
      <div style={{ fontSize, fontWeight:900, color:'#fff', lineHeight:1 }}>{ticker.base}</div>
      <div style={{ fontSize:fontSize - 2, fontWeight:800, color:textColor, lineHeight:1 }}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </div>
    </motion.div>
  );
}

// ── AI Signal badge ───────────────────────────────────────────────────────
function AISignalRow({ ticker }: { ticker: Ticker }) {
  const pct = ticker.priceChangePct;
  const signal = pct > 3 ? 'STRONG BUY' : pct > 1 ? 'BUY' : pct > -1 ? 'NEUTRAL' : pct > -3 ? 'CAUTION' : 'AVOID';
  const color  = signal === 'STRONG BUY' ? '#00e676' : signal === 'BUY' ? '#69f0ae' : signal === 'NEUTRAL' ? '#ffd740' : signal === 'CAUTION' ? '#f97316' : '#f43f5e';

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,0.025)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:13, fontWeight:900, color:'#fff' }}>{ticker.base}</span>
        <span style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'var(--font-mono)' }}>${ticker.lastPrice.toLocaleString()}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:12, fontWeight:900, color: pct >= 0 ? '#00e676' : '#f43f5e', fontFamily:'var(--font-mono)' }}>
          {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
        </span>
        <span style={{ fontSize:9, fontWeight:900, color, background:`${color}18`, border:`1px solid ${color}40`, padding:'3px 10px', borderRadius:99, letterSpacing:'0.1em' }}>
          {signal}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ════════════════════════════════════════════════════════════════════════════
interface Props {
  tickers: Ticker[];
  selected: Ticker | null;
  onSelect: (t: Ticker) => void;
}

export default function MarketValuePanel({ tickers, selected, onSelect }: Props) {
  const [view, setView] = useState<'heatmap' | 'signals' | 'stats'>('heatmap');

  // Derived stats
  const gainers = tickers.filter(t => t.priceChangePct > 0);
  const losers  = tickers.filter(t => t.priceChangePct < 0);
  const totalVol = tickers.reduce((s, t) => s + (t.quoteVolume || 0), 0);
  const top5     = [...tickers].sort((a, b) => b.priceChangePct - a.priceChangePct).slice(0, 5);
  const bottom5  = [...tickers].sort((a, b) => a.priceChangePct - b.priceChangePct).slice(0, 5);
  const mostVol  = [...tickers].sort((a, b) => (b.quoteVolume || 0) - (a.quoteVolume || 0)).slice(0, 5);

  const sentiment = gainers.length > losers.length ? 'BULLISH' : gainers.length < losers.length ? 'BEARISH' : 'NEUTRAL';
  const sentimentColor = sentiment === 'BULLISH' ? '#00e676' : sentiment === 'BEARISH' ? '#f43f5e' : '#ffd740';

  const fmtVol = (v: number) => v > 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v > 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v.toFixed(0)}`;

  if (tickers.length === 0) return null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Market Pulse header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Activity size={14} color="var(--accent-orange)"/>
          <span style={{ fontSize:11, fontWeight:900, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-secondary)' }}>Market Pulse</span>
          <span style={{ fontSize:9, fontWeight:900, color:sentimentColor, background:`${sentimentColor}18`, border:`1px solid ${sentimentColor}40`, padding:'2px 10px', borderRadius:99 }}>
            {sentiment}
          </span>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {(['heatmap','signals','stats'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding:'4px 12px', borderRadius:8, border:`1px solid ${view===v ? 'var(--accent-orange)' : 'rgba(255,255,255,0.08)'}`, background: view===v ? 'rgba(249,115,22,0.12)' : 'transparent', color: view===v ? 'var(--accent-orange)' : 'var(--text-dim)', fontSize:9, fontWeight:900, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase', transition:'all 0.2s' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick stat row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        <StatCard label="Total Vol 24H" value={fmtVol(totalVol)} sub="All pairs"/>
        <StatCard label="Gainers" value={`${gainers.length}`} sub={`of ${tickers.length} pairs`} color="#00e676"/>
        <StatCard label="Losers"  value={`${losers.length}`}  sub={`of ${tickers.length} pairs`} color="#f43f5e"/>
        <StatCard label="Top Gainer" value={`+${top5[0]?.priceChangePct.toFixed(1)}%`} sub={top5[0]?.base} color="#00e676"/>
      </div>

      {/* ── HEATMAP VIEW ── */}
      {view === 'heatmap' && (
        <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:16 }}>
          <div style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, letterSpacing:'.12em', marginBottom:12 }}>
            MARKET HEATMAP — click to select · green = up · red = down
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {tickers.map(t => (
              <HeatTile key={t.symbol} ticker={t} onSelect={onSelect} isSelected={selected?.symbol === t.symbol}/>
            ))}
          </div>
        </div>
      )}

      {/* ── SIGNALS VIEW ── */}
      {view === 'signals' && (
        <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:16 }}>
          <div style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, letterSpacing:'.12em', marginBottom:12 }}>
            MOMENTUM SIGNALS — based on 24H price change
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[...tickers].sort((a,b) => b.priceChangePct - a.priceChangePct).map(t => (
              <AISignalRow key={t.symbol} ticker={t}/>
            ))}
          </div>
        </div>
      )}

      {/* ── STATS VIEW ── */}
      {view === 'stats' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          {/* Top Gainers */}
          <div style={{ background:'rgba(0,230,118,0.04)', border:'1px solid rgba(0,230,118,0.15)', borderRadius:14, padding:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <TrendingUp size={12} color="#00e676"/>
              <span style={{ fontSize:9, fontWeight:900, color:'#00e676', letterSpacing:'.12em' }}>TOP GAINERS</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {top5.map((t,i) => (
                <div key={t.symbol} onClick={() => onSelect(t)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:12, fontWeight:900, color:'#fff' }}>{i+1}. {t.base}</span>
                  <span style={{ fontSize:12, fontWeight:900, color:'#00e676', fontFamily:'var(--font-mono)' }}>+{t.priceChangePct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div style={{ background:'rgba(244,63,94,0.04)', border:'1px solid rgba(244,63,94,0.15)', borderRadius:14, padding:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <TrendingDown size={12} color="#f43f5e"/>
              <span style={{ fontSize:9, fontWeight:900, color:'#f43f5e', letterSpacing:'.12em' }}>TOP LOSERS</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {bottom5.map((t,i) => (
                <div key={t.symbol} onClick={() => onSelect(t)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:12, fontWeight:900, color:'#fff' }}>{i+1}. {t.base}</span>
                  <span style={{ fontSize:12, fontWeight:900, color:'#f43f5e', fontFamily:'var(--font-mono)' }}>{t.priceChangePct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Most Active */}
          <div style={{ background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:14, padding:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <Zap size={12} color="var(--accent-orange)"/>
              <span style={{ fontSize:9, fontWeight:900, color:'var(--accent-orange)', letterSpacing:'.12em' }}>MOST ACTIVE</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {mostVol.map((t,i) => (
                <div key={t.symbol} onClick={() => onSelect(t)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:12, fontWeight:900, color:'#fff' }}>{i+1}. {t.base}</span>
                  <span style={{ fontSize:11, fontWeight:800, color:'rgba(255,255,255,0.5)', fontFamily:'var(--font-mono)' }}>{fmtVol(t.quoteVolume||0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
