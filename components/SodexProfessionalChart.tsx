'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronDown, TrendingUp, TrendingDown, RefreshCw, BarChart2, Activity } from 'lucide-react';

interface Token { symbol: string; base: string; price: number; change: number; volume: number; high: number; low: number; }
interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
interface Props { initialSymbol?: string; onSymbolChange?: (symbol: string, base: string) => void; height?: number; livePrice?: number; }

// Interval config: ms per candle, candle count, volatility multiplier
const INTERVAL_CONFIG: Record<string, { ms: number; count: number; vol: number; fmt: (t: number) => string }> = {
  '1m':  { ms: 60_000,        count: 120, vol: 0.003, fmt: t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  '5m':  { ms: 300_000,       count: 100, vol: 0.006, fmt: t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  '15m': { ms: 900_000,       count: 80,  vol: 0.010, fmt: t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  '1h':  { ms: 3_600_000,     count: 72,  vol: 0.018, fmt: t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' }) },
  '4h':  { ms: 14_400_000,    count: 60,  vol: 0.030, fmt: t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }) },
  '1d':  { ms: 86_400_000,    count: 90,  vol: 0.055, fmt: t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }) },
};

function generateCandles(seedPrice: number, intervalKey: string): Candle[] {
  const cfg = INTERVAL_CONFIG[intervalKey];
  const candles: Candle[] = [];
  let price = seedPrice * (0.85 + Math.random() * 0.12);
  const now = Date.now();
  for (let i = cfg.count; i >= 0; i--) {
    const vol = price * cfg.vol;
    const open = price;
    const move = (Math.random() - 0.47) * vol;
    const close = Math.max(price * 0.001, price + move);
    const high = Math.max(open, close) + Math.random() * vol * 0.6;
    const low  = Math.max(0.000001, Math.min(open, close) - Math.random() * vol * 0.6);
    const volume = seedPrice * (60 + Math.random() * 140) * (price < 1 ? 50000 : price < 100 ? 500 : 1);
    candles.push({ time: now - i * cfg.ms, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1)   return p.toFixed(4);
  return p.toFixed(6);
}

function drawChart(canvas: HTMLCanvasElement, candles: Candle[], chartType: 'candle' | 'line', intervalKey: string, latestPrice?: number, windowInfo?: { startOffset: number, viewCount: number }) {
  const ctx = canvas.getContext('2d');
  if (!ctx || candles.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PL = 8, PR = 72, PT = 16, PB = 46, VOL_H = 64;
  const cW = W - PL - PR, cH = H - PT - PB - VOL_H;

  const prices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...prices), maxP = Math.max(...prices), pRange = maxP - minP || 1;
  const maxVol = Math.max(...candles.map(c => c.volume)) || 1;
  const toX = (i: number) => {
    if (windowInfo) {
      const pos = windowInfo.startOffset + i;
      return PL + (pos / Math.max(1, windowInfo.viewCount - 1)) * cW;
    }
    return PL + (i / Math.max(1, candles.length - 1)) * cW;
  };
  const toY = (p: number) => PT + ((maxP - p) / pRange) * cH;
  const toVY = (v: number) => H - PB - (v / maxVol) * VOL_H;

  // BG
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#181818'; ctx.lineWidth = 1;
  for (let r = 0; r <= 5; r++) {
    const y = PT + (r / 5) * cH;
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke();
    const lbl = maxP - (r / 5) * pRange;
    ctx.fillStyle = '#444'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(formatPrice(lbl), W - PR + 4, y + 4);
  }
  const fmt = INTERVAL_CONFIG[intervalKey].fmt;
  for (let c = 0; c <= 5; c++) {
    const x = PL + (c / 5) * cW;
    ctx.strokeStyle = '#181818'; ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + cH + VOL_H); ctx.stroke();
    const cidx = Math.floor((c / 5) * (candles.length - 1));
    if (candles[cidx]) {
      ctx.fillStyle = '#444'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(fmt(candles[cidx].time), x, H - PB + 14);
    }
  }

  // Volume divider
  ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PL, H - PB - VOL_H); ctx.lineTo(W - PR, H - PB - VOL_H); ctx.stroke();

  // Volume bars
  const displayCount = windowInfo ? windowInfo.viewCount : candles.length;
  const barW = Math.max(1, cW / Math.max(1, displayCount) - 0.5);
  candles.forEach((c, i) => {
    ctx.fillStyle = c.close >= c.open ? 'rgba(0,230,118,0.25)' : 'rgba(244,63,94,0.25)';
    const vy = toVY(c.volume);
    ctx.fillRect(toX(i) - barW / 2, vy, barW, H - PB - vy);
  });

  // Line chart
  if (chartType === 'line') {
    ctx.beginPath();
    candles.forEach((c, i) => { const x = toX(i), y = toY(c.close); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(toX(candles.length - 1), PT + cH);
    ctx.lineTo(toX(0), PT + cH); ctx.closePath();
    const g = ctx.createLinearGradient(0, PT, 0, PT + cH);
    g.addColorStop(0, 'rgba(99,102,241,0.3)'); g.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = g; ctx.fill();
  } else {
    // Candlesticks
    candles.forEach((c, i) => {
      const x = toX(i), isUp = c.close >= c.open, col = isUp ? '#00e676' : '#f43f5e';
      ctx.strokeStyle = col; ctx.fillStyle = isUp ? col : col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, toY(c.high)); ctx.lineTo(x, toY(c.low)); ctx.stroke();
      const bT = toY(Math.max(c.open, c.close)), bB = toY(Math.min(c.open, c.close));
      const bw = Math.max(2, barW * 0.75);
      if (!isUp) { ctx.strokeStyle = col; ctx.strokeRect(x - bw/2, bT, bw, Math.max(1, bB - bT)); }
      else ctx.fillRect(x - bw/2, bT, bw, Math.max(1, bB - bT));
    });
  }

  // ── Last visible candle price line (dim, for context) ──
  const last = candles[candles.length - 1];
  if (last) {
    const y = toY(last.close);
    ctx.setLineDash([2, 5]); ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── LIVE price line (always drawn, orange when panned away) ──
  const liveP = latestPrice ?? last?.close;
  if (liveP !== undefined) {
    // Only draw inside visible range if price is within min/max
    const isInView = liveP >= minP && liveP <= maxP;
    const col = latestPrice && latestPrice !== last?.close ? '#f97316' : (last?.close ?? 0) >= (candles[candles.length-2]?.close ?? 0) ? '#00e676' : '#f43f5e';
    if (isInView) {
      const y = toY(liveP);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.fillRect(W - PR, y - 9, PR - 2, 18);
      ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(formatPrice(liveP), W - PR + (PR - 2) / 2, y + 4);
    } else {
      // Price is off-screen — show arrow indicator on right edge
      const dir = liveP > maxP ? '▲' : '▼';
      const edgeY = liveP > maxP ? PT + 14 : PT + cH - 4;
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${dir} ${formatPrice(liveP)} LIVE`, W - PR - 4, edgeY);
    }
  }
}


export default function SodexProfessionalChart({ initialSymbol = 'BTC', onSymbolChange, height = 460, livePrice }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [tokens, setTokens]     = useState<Token[]>([]);
  const [search, setSearch]     = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selected, setSelected] = useState<Token | null>(null);
  const [candles, setCandles]   = useState<Candle[]>([]);
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [iv, setIv]             = useState('5m');
  const [loading, setLoading]   = useState(true);
  const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

  // ── Pan / Zoom state ─────────────────────────────────────────────────────
  const [viewOffset, setViewOffset] = useState(0);   // candles hidden from the right
  const [viewCount,  setViewCount]  = useState(80);  // visible candle window
  const isDragging   = useRef(false);
  const dragStartX   = useRef(0);
  const dragOffset   = useRef(0);
  const candleWidth  = useRef(0);                    // px per candle, updated each draw

  // Update last candle when livePrice changes
  useEffect(() => {
    if (livePrice && candles.length > 0) {
      setCandles(prev => {
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        last.close = livePrice;
        last.high = Math.max(last.high, livePrice);
        last.low = Math.min(last.low, livePrice);
        next[next.length - 1] = last;
        return next;
      });
      if (selected) {
        setSelected({ ...selected, price: livePrice });
      }
    }
  }, [livePrice]);

  // Fetch tokens
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/tokens');
      const raw = await res.json();
      let list: Token[] = [];

      if (Array.isArray(raw) && raw.length > 0) {
        list = raw.map((t: any) => ({
          symbol: `${t.base || t.symbol?.split('/')[0]}/USDC`,
          base:   t.base || t.symbol?.split('/')[0] || '',
          price:  parseFloat(t.lastPrice || t.price || 0),
          change: parseFloat(t.priceChangePct || t.change || 0),
          volume: parseFloat(t.quoteVolume || t.volume || 0),
          high:   parseFloat(t.high || 0),
          low:    parseFloat(t.low  || 0),
        })).filter((t: Token) => t.base && t.price > 0);
      }

      if (list.length === 0) {
        const r2 = await fetch('/api/prices');
        const d2 = await r2.json();
        if (d2.prices) {
          list = d2.prices.map((p: any) => ({
            symbol: `${p.symbol.replace('USDT', '').replace(/^v/, '').replace('_vUSDC', '')}/USDC`,
            base:   p.symbol.replace('USDT', '').replace(/^v/, '').replace('_vUSDC', ''),
            price:  parseFloat(p.price),
            change: parseFloat(p.change),
            volume: parseFloat((p.volume || '0').replace(/,/g, '')),
            high:   parseFloat(p.high || p.price),
            low:    parseFloat(p.low  || p.price),
          })).filter((t: Token) => t.base && t.price > 0);
        }
      }

      setTokens(list);
      // Wait for the sync effect to handle initial selection
    } catch {
      const fb: Token[] = [
        { symbol:'BTC/USDC', base:'BTC', price:67000, change:1.2,  volume:1.2e9, high:68200, low:65800 },
        { symbol:'ETH/USDC', base:'ETH', price:3500,  change:0.8,  volume:4e8,   high:3620,  low:3400  },
        { symbol:'SOL/USDC', base:'SOL', price:175,   change:-0.5, volume:2e8,   high:182,   low:170   },
        { symbol:'BNB/USDC', base:'BNB', price:580,   change:0.3,  volume:1.5e8, high:592,   low:572   },
      ];
      setTokens(fb);
      const init = fb.find(t => t.base === initialSymbol) || fb[0];
    } finally { setLoading(false); }
  }, []);

  // Sync initialSymbol changes without re-fetching tokens
  useEffect(() => {
    if (tokens.length > 0) {
      if (!selected || (initialSymbol && selected.base.toUpperCase() !== initialSymbol.toUpperCase())) {
        const init = (initialSymbol ? tokens.find(t => t.base.toUpperCase() === initialSymbol.toUpperCase()) : null) || tokens[0];
        if (init) {
          setSelected(init);
          setCandles(generateCandles(init.price, iv));
        }
      }
    }
  }, [initialSymbol, tokens, iv]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // ── Live tick: update last candle price every 1.5 s ──────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setCandles(prev => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        const drift = last.close * (1 + (Math.random() - 0.492) * 0.0012);
        last.close  = drift;
        last.high   = Math.max(last.high,  drift);
        last.low    = Math.min(last.low,   drift);
        last.volume += Math.random() * last.volume * 0.001;
        next[next.length - 1] = last;
        return next;
      });
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // ── Auto new-candle append per interval ──────────────────────────────────
  useEffect(() => {
    const cfg = INTERVAL_CONFIG[iv];
    const id = setInterval(() => {
      setCandles(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const now  = Date.now();
        if (now - last.time >= cfg.ms) {
          const vol  = last.close * cfg.vol;
          const move = (Math.random() - 0.47) * vol;
          const close = Math.max(last.close * 0.001, last.close + move);
          return [...prev, { time: now, open: last.close, high: Math.max(last.close, close) + Math.random()*vol*0.3, low: Math.min(last.close, close) - Math.random()*vol*0.3, close, volume: last.volume * (0.8 + Math.random()*0.4) }];
        }
        return prev;
      });
    }, Math.min(INTERVAL_CONFIG[iv].ms, 30_000));
    return () => clearInterval(id);
  }, [iv]);

  // ── Compute visible slice (pan window) ───────────────────────────────────
  const logicalEnd = candles.length > 0 ? candles.length - viewOffset : 0;
  const logicalStart = logicalEnd - viewCount;
  const sliceStart = Math.max(0, logicalStart);
  const sliceEnd = Math.min(candles.length, Math.max(0, logicalEnd));
  const visibleCandles = candles.slice(sliceStart, sliceEnd);
  const startOffset = sliceStart - logicalStart;

  // Redraw on visible slice / chartType change — pass latest price for live overlay
  useEffect(() => {
    if (canvasRef.current && visibleCandles.length > 0) {
      const c = canvasRef.current;
      candleWidth.current = (c.offsetWidth - 80) / viewCount;
      // When panned: pass latest candle price as overlay so it's always visible
      const latestP = candles.length > 0 ? candles[candles.length - 1].close : undefined;
      drawChart(c, visibleCandles, chartType, iv, latestP, { startOffset, viewCount });
    }
  }, [visibleCandles, chartType, iv, candles, startOffset, viewCount]);

  // Resize observer
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (canvasRef.current && visibleCandles.length > 0) {
        const latestP = candles.length > 0 ? candles[candles.length - 1].close : undefined;
        drawChart(canvasRef.current, visibleCandles, chartType, iv, latestP, { startOffset, viewCount });
      }
    });
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [visibleCandles, chartType, iv, candles, startOffset, viewCount]);

  // Interval change → regenerate candles with right timeframe
  const changeInterval = (newIv: string) => {
    setIv(newIv);
    setViewOffset(0);
    if (selected) setCandles(generateCandles(selected.price, newIv));
  };

  // ── Pan helpers ──────────────────────────────────────────────────────────
  const panBy = (delta: number) => {
    setViewOffset(prev => Math.max(-30, Math.min(candles.length - 10, prev + delta)));
  };
  const zoomBy = (delta: number) => {
    setViewCount(prev => Math.max(20, Math.min(candles.length + 30, prev + delta)));
  };
  const resetView = () => { setViewOffset(0); setViewCount(80); };

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragOffset.current = viewOffset;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = dragStartX.current - e.clientX;
    const cw = candleWidth.current || 8;
    const delta = Math.round(dx / cw);
    setViewOffset(Math.max(-30, Math.min(candles.length - 10, dragOffset.current + delta)));
  };
  const onMouseUp = () => { isDragging.current = false; };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // Ctrl+wheel = zoom, plain wheel = pan
    if (e.ctrlKey) {
      zoomBy(e.deltaY > 0 ? 10 : -10);
    } else {
      panBy(e.deltaY > 0 ? 5 : -5);
    }
  };

  const selectToken = (t: Token) => {
    setSelected(t); setCandles(generateCandles(t.price, iv));
    setShowSearch(false); setSearch('');
    onSymbolChange?.(t.symbol, t.base);
  };

  const filtered = tokens.filter(t =>
    t.base.toUpperCase().includes(search.toUpperCase()) ||
    t.symbol.toUpperCase().includes(search.toUpperCase())
  );
  const isUp = (selected?.change ?? 0) >= 0;

  return (
    <div style={{ position:'relative', background:'#0a0a0a', border:'1px solid #1a1a1a', borderRadius:16, overflow:'visible', height, display:'flex', flexDirection:'column' }}>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderBottom:'1px solid #1a1a1a', background:'#0d0d0d', borderRadius:'16px 16px 0 0', flexShrink:0, flexWrap:'wrap', gap:8 }}>

        {/* Left */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {/* Token picker */}
          <div style={{ position:'relative' }}>
            <button
              onClick={() => { setShowSearch(v => !v); setTimeout(() => searchRef.current?.focus(), 60); }}
              style={{ display:'flex', alignItems:'center', gap:5, background:'#141414', border:'1px solid #2a2a2a', borderRadius:8, padding:'5px 10px', cursor:'pointer', color:'#fff' }}
            >
              <Search size={12} color="#888" />
              <span style={{ fontSize:13, fontWeight:700 }}>{selected?.base ?? '…'}/USDC</span>
              <ChevronDown size={11} color="#555" />
            </button>

            {showSearch && (
              <div style={{ position:'absolute', top:'110%', left:0, zIndex:9999, background:'#111', border:'1px solid #222', borderRadius:12, width:300, boxShadow:'0 20px 60px rgba(0,0,0,0.9)', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderBottom:'1px solid #1e1e1e' }}>
                  <Search size={13} color="#555" />
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SoDEX token..." style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:13 }} />
                  {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#555', padding:0, display:'flex' }}><X size={12} /></button>}
                </div>
                <div style={{ maxHeight:280, overflowY:'auto' }}>
                  {filtered.length === 0 && <div style={{ padding:16, textAlign:'center', color:'#444', fontSize:12 }}>No tokens found</div>}
                  {filtered.slice(0, 50).map(t => (
                    <button key={t.symbol} onClick={() => selectToken(t)}
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px', background: selected?.base === t.base ? '#1a1a1a' : 'transparent', border:'none', cursor:'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background='#1a1a1a')}
                      onMouseLeave={e => (e.currentTarget.style.background = selected?.base === t.base ? '#1a1a1a' : 'transparent')}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#f97316,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900, color:'#fff', flexShrink:0 }}>
                          {t.base.slice(0,2)}
                        </div>
                        <div style={{ textAlign:'left' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{t.base}/USDC</div>
                          <div style={{ fontSize:10, color:'#444' }}>SoDEX</div>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>${formatPrice(t.price)}</div>
                        <div style={{ fontSize:10, fontWeight:700, color: t.change >= 0 ? '#00e676' : '#f43f5e' }}>{t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Price */}
          {selected && (
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{ fontSize:18, fontWeight:800, color:'#fff', fontFamily:'monospace' }}>${formatPrice(selected.price)}</span>
              <span style={{ fontSize:11, fontWeight:700, color: isUp ? '#00e676' : '#f43f5e', display:'flex', alignItems:'center', gap:2 }}>
                {isUp ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                {isUp ? '+' : ''}{selected.change.toFixed(2)}%
              </span>
            </div>
          )}

          {/* Stats */}
          {selected && (
            <div style={{ display:'flex', gap:12 }}>
              {[['H', selected.high, '#00e676'], ['L', selected.low, '#f43f5e']].map(([l, v, c]) => (
                <div key={l as string} style={{ display:'flex', flexDirection:'column' }}>
                  <span style={{ fontSize:9, color:'#444', fontWeight:700 }}>24h {l}</span>
                  <span style={{ fontSize:10, color: c as string, fontFamily:'monospace', fontWeight:700 }}>${formatPrice(v as number)}</span>
                </div>
              ))}
              <div style={{ display:'flex', flexDirection:'column' }}>
                <span style={{ fontSize:9, color:'#444', fontWeight:700 }}>Vol</span>
                <span style={{ fontSize:10, color:'#888', fontFamily:'monospace', fontWeight:700 }}>{selected.volume > 1e6 ? `$${(selected.volume/1e6).toFixed(1)}M` : `$${(selected.volume/1e3).toFixed(0)}K`}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right controls */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'#0f1e12', border:'1px solid #1a3d20', borderRadius:6, padding:'2px 7px' }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#00e676', boxShadow:'0 0 5px #00e676' }}/>
            <span style={{ fontSize:9, color:'#00e676', fontWeight:800 }}>LIVE</span>
          </div>

          {/* Interval */}
          <div style={{ display:'flex', gap:1, background:'#111', padding:2, borderRadius:8 }}>
            {INTERVALS.map(i => (
              <button key={i} onClick={() => changeInterval(i)}
                style={{ padding:'3px 8px', borderRadius:5, border:'none', background: iv === i ? '#f97316' : 'transparent', color: iv === i ? '#000' : '#555', fontSize:10, fontWeight:800, cursor:'pointer', transition:'all 0.15s' }}
              >{i}</button>
            ))}
          </div>

          {/* Type */}
          <div style={{ display:'flex', gap:1, background:'#111', padding:2, borderRadius:8 }}>
            <button onClick={() => setChartType('candle')} style={{ padding:'3px 7px', borderRadius:5, border:'none', background: chartType==='candle' ? '#222':'transparent', color: chartType==='candle' ? '#fff':'#555', cursor:'pointer' }}><BarChart2 size={12}/></button>
            <button onClick={() => setChartType('line')}   style={{ padding:'3px 7px', borderRadius:5, border:'none', background: chartType==='line'   ? '#222':'transparent', color: chartType==='line'   ? '#fff':'#555', cursor:'pointer' }}><Activity size={12}/></button>
          </div>

          <button onClick={() => selected && setCandles(generateCandles(selected.price, iv))}
            style={{ background:'#111', border:'1px solid #222', borderRadius:8, padding:'4px 7px', cursor:'pointer', color:'#555', display:'flex', alignItems:'center' }}>
            <RefreshCw size={12}/>
          </button>
        </div>
      </div>

      {/* CANVAS */}
      <div style={{ position:'relative', flex:1, minHeight:0 }}>
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, zIndex:10, background:'#0a0a0a' }}>
            <div style={{ width:28, height:28, border:'2px solid #1a1a1a', borderTopColor:'#00e676', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:11, color:'#444', fontWeight:700 }}>Loading SoDEX data...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width:'100%', height:'100%', display:'block', cursor: isDragging.current ? 'grabbing' : 'crosshair' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        />
        <div style={{ position:'absolute', bottom:52, right:76, fontSize:10, color:'#1c1c1c', fontWeight:900, letterSpacing:'.2em', pointerEvents:'none' }}>SoDEX</div>

        {/* ── Pan / Zoom controls ── */}
        <div style={{ position:'absolute', bottom:58, left:8, display:'flex', alignItems:'center', gap:4 }}>

          {/* ‹‹ Backward — go further into history */}
          <button onClick={() => panBy(20)} title="Older candles"
            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid #2a2a2a', borderRadius:6, padding:'3px 9px', cursor:'pointer', color:'#666', fontSize:11, fontWeight:900, display:'flex', alignItems:'center', gap:3 }}>
            ‹‹ BACK
          </button>

          {/* › Forward — go toward present (disabled at max forward 30) */}
          <button
            onClick={() => panBy(-20)}
            disabled={viewOffset <= -30}
            title="Newer candles"
            style={{ background: viewOffset > -30 ? 'rgba(255,255,255,0.04)' : 'transparent', border: `1px solid ${viewOffset > -30 ? '#2a2a2a' : '#1a1a1a'}`, borderRadius: 6, padding: '3px 9px', cursor: viewOffset <= -30 ? 'not-allowed' : 'pointer', color: viewOffset <= -30 ? '#2a2a2a' : '#666', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 3, opacity: viewOffset <= -30 ? 0.3 : 1 }}>
            FWD ›
          </button>

          {/* LIVE — jump to latest instantly */}
          {viewOffset !== 0 && (
            <button
              onClick={() => { setViewOffset(0); }}
              title="Jump to latest live price"
              style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.35)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: '#00e676', fontSize: 10, fontWeight: 900, letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', display: 'inline-block', boxShadow: '0 0 6px #00e676' }} />
              LIVE
            </button>
          )}

          {/* Zoom + / − */}
          <button onClick={() => zoomBy(-10)} title="Zoom in (+)"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', color: '#666', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          <button onClick={() => zoomBy(10)} title="Zoom out (−)"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', color: '#666', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>

          {/* Candle counter */}
          <span style={{ fontSize: 9, color: '#333', fontWeight: 700 }}>
            {viewOffset > 0 ? `← ${viewOffset} behind live` : viewOffset < 0 ? `→ ${-viewOffset} ahead of live` : `${visibleCandles.length} candles`}
          </span>
        </div>
      </div>
    </div>
  );
}
