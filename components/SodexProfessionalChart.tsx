'use client';

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { useSodexStore } from '@/store/sodexStore';
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type IPriceLine,
} from 'lightweight-charts';
import { Search, X, ChevronDown, TrendingUp, TrendingDown, RefreshCw, BarChart2, Activity } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Token {
  symbol: string;
  base: string;
  price: number;
  change: number;
  volume: number;
  high: number;
  low: number;
}

interface OHLCVCandle {
  time: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  initialSymbol?: string;
  onSymbolChange?: (symbol: string, base: string) => void;
  height?: number;
  tradeSetup?: { entry: number; sl: number; tp: number[]; side: 'BUY' | 'SELL' };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = typeof INTERVALS[number];

const INTERVAL_MS: Record<Interval, number> = {
  '1m':  60_000,
  '5m':  300_000,
  '15m': 900_000,
  '1h':  3_600_000,
  '4h':  14_400_000,
  '1d':  86_400_000,
};

const CHART_THEME = {
  background: '#09090f',
  grid: '#111120',
  text: '#6b7280',
  border: '#1e1e3a',
  upColor: '#2bd9a8',
  downColor: '#ff6b6b',
  wickUpColor: '#2bd9a8',
  wickDownColor: '#ff6b6b',
  crosshair: '#f97316',
};

// ─── Stable fallback candles (deterministic, no Math.random) ─────────────────
function makeStableCandles(seedPrice: number, intervalKey: Interval, count = 120): OHLCVCandle[] {
  const ms = INTERVAL_MS[intervalKey];
  const now = Date.now();
  const candles: OHLCVCandle[] = [];
  let price = seedPrice * 0.88;

  for (let i = count; i >= 0; i--) {
    const r1 = Math.abs(Math.sin(i * 7919.1));
    const r2 = Math.abs(Math.cos(i * 3571.7));
    const volPct = INTERVAL_MS[intervalKey] / 86_400_000 * 0.06;
    const open = price;
    const move = (r1 - 0.46) * price * volPct;
    const close = Math.max(price * 0.001, price + move);
    const high = Math.max(open, close) * (1 + r2 * volPct * 0.5);
    const low  = Math.min(open, close) * (1 - r2 * volPct * 0.5);
    candles.push({
      time: now - i * ms,
      open, high, low, close,
      volume: seedPrice * (80 + r1 * 120) * (price < 1 ? 10000 : price < 100 ? 100 : 1),
    });
    price = close;
  }
  // Snap last candle's close to actual live price
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = seedPrice;
    last.high = Math.max(last.high, seedPrice);
    last.low  = Math.min(last.low,  seedPrice);
  }
  return candles;
}

// ─── Fetch from Binance with AbortController ──────────────────────────────────
async function fetchBinanceCandles(
  base: string,
  price: number,
  interval: Interval,
  signal: AbortSignal,
): Promise<OHLCVCandle[]> {
  const symbol = `${base.toUpperCase()}USDT`;
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=120`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const raw = await res.json() as [number, string, string, string, string, string][];
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty');

    const candles: OHLCVCandle[] = raw.map((k) => ({
      time:   k[0],
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    // Sync last candle to live SoDEX price
    if (candles.length > 0 && price > 0) {
      const last = candles[candles.length - 1];
      last.close = price;
      last.high  = Math.max(last.high, price);
      last.low   = Math.min(last.low,  price);
    }
    return candles;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e; // re-throw so caller can detect
    // Non-Binance token (SOSO, MEME etc) — use deterministic fallback
    return makeStableCandles(price, interval);
  }
}

function formatPrice(p: number): string {
  if (!p || isNaN(p)) return '—';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100)   return p.toFixed(2);
  if (p >= 1)     return p.toFixed(4);
  return p.toFixed(6);
}

// ─── Component ────────────────────────────────────────────────────────────────
const SodexProfessionalChart = memo(function SodexProfessionalChart({ initialSymbol = 'BTC', onSymbolChange, height = 460, tradeSetup }: Props) {
  const livePrice = useSodexStore(state => state.tickers.get(initialSymbol + 'USDT')?.lastPrice);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const candleSeriesRef   = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef   = useRef<ISeriesApi<'Histogram'> | null>(null);
  const abortRef          = useRef<AbortController | null>(null);
  
  // Refs for dynamic price lines
  const entryLineRef = useRef<IPriceLine | null>(null);
  const slLineRef    = useRef<IPriceLine | null>(null);
  const tpLineRefs   = useRef<IPriceLine[]>([]);

  const searchRef         = useRef<HTMLInputElement>(null);
  const [tokens,      setTokens]      = useState<Token[]>([]);
  const [selected,    setSelected]    = useState<Token | null>(null);
  const [search,      setSearch]      = useState('');
  const [showSearch,  setShowSearch]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [iv,          setIv]          = useState<Interval>('5m');
  const [chartType,   setChartType]   = useState<'candle' | 'line'>('candle');

  // ── Create chart once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_THEME.background },
        textColor: CHART_THEME.text,
        fontFamily: "'Inter', 'SF Mono', monospace",
      },
      grid: {
        vertLines: { color: CHART_THEME.grid },
        horzLines: { color: CHART_THEME.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_THEME.crosshair, labelBackgroundColor: CHART_THEME.crosshair },
        horzLine: { color: CHART_THEME.crosshair, labelBackgroundColor: CHART_THEME.crosshair },
      },
      rightPriceScale: {
        borderColor: CHART_THEME.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: CHART_THEME.border,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale:  { mouseWheel: true, pinch: true },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor:          CHART_THEME.upColor,
      downColor:        CHART_THEME.downColor,
      borderUpColor:    CHART_THEME.upColor,
      borderDownColor:  CHART_THEME.downColor,
      wickUpColor:      CHART_THEME.wickUpColor,
      wickDownColor:    CHART_THEME.wickDownColor,
    });

    const volume = chart.addSeries(HistogramSeries, {
      color: '#2bd9a844',
      priceFormat: { type: 'volume' as const },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candle;
    volumeSeriesRef.current = volume;

    // Resize observer
    const resizeObs = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width:  chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    if (chartContainerRef.current) resizeObs.observe(chartContainerRef.current);

    return () => {
      resizeObs.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // ── Load candle data ───────────────────────────────────────────────────────
  const loadCandles = useCallback(async (token: Token, interval: Interval) => {
    // Cancel any in-flight request immediately
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setFetchError(null);

    try {
      const candles = await fetchBinanceCandles(token.base, token.price, interval, controller.signal);

      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      const lwCandles = candles.map((c) => ({
        time:  Math.floor(c.time / 1000) as Time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }));

      const lwVolumes = candles.map((c) => ({
        time:  Math.floor(c.time / 1000) as Time,
        value: c.volume,
        color: c.close >= c.open ? '#2bd9a833' : '#ff6b6b33',
      }));

      candleSeriesRef.current.setData(lwCandles);
      volumeSeriesRef.current.setData(lwVolumes);
      chartRef.current?.timeScale().fitContent();
      setLoading(false);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // Intentional — no error state
      setFetchError('Failed to load chart data');
      setLoading(false);
    }
  }, []);

  // ── Sync live price into last candle ──────────────────────────────────────
  useEffect(() => {
    if (!livePrice || !candleSeriesRef.current || !selected) return;

    const now = Math.floor(Date.now() / 1000) as Time;
    const intervalMs = INTERVAL_MS[iv];
    const intervalSec = Math.floor(intervalMs / 1000);
    const candleTime = (Math.floor(Date.now() / intervalMs) * intervalSec) as Time;

    candleSeriesRef.current.update({
      time:  candleTime,
      open:  selected.price,
      high:  Math.max(selected.price, livePrice),
      low:   Math.min(selected.price, livePrice),
      close: livePrice,
    });

    // Keep the selected token price in sync
    setSelected((prev) => prev ? { ...prev, price: livePrice } : prev);
  }, [livePrice, iv, selected?.base]);

  // ── Fetch token list ───────────────────────────────────────────────────────
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/tokens');
      const raw = await res.json();
      let list: Token[] = [];

      if (Array.isArray(raw) && raw.length > 0) {
        list = (raw as Record<string, unknown>[]).map((t) => ({
          symbol: `${String(t.base ?? t.symbol ?? '').split('/')[0]}/USDC`,
          base:   String(t.base ?? String(t.symbol ?? '').split('/')[0] ?? '').replace(/^v/, ''),
          price:  parseFloat(String(t.lastPrice ?? t.price ?? 0)),
          change: parseFloat(String(t.priceChangePct ?? t.change ?? 0)),
          volume: parseFloat(String(t.quoteVolume ?? t.volume ?? 0)),
          high:   parseFloat(String(t.high ?? 0)),
          low:    parseFloat(String(t.low  ?? 0)),
        })).filter((t) => t.base && t.price > 0);
      }

      if (list.length === 0) throw new Error('empty');
      setTokens(list);
    } catch {
      // Sensible fallback tokens
      const fallback: Token[] = [
        { symbol: 'BTC/USDC', base: 'BTC', price: 77000, change: 0.5,  volume: 1.2e9, high: 78000, low: 76000 },
        { symbol: 'ETH/USDC', base: 'ETH', price: 2100,  change: -0.3, volume: 4e8,   high: 2200,  low: 2050  },
        { symbol: 'SOL/USDC', base: 'SOL', price: 140,   change: 0.8,  volume: 2e8,   high: 145,   low: 138   },
        { symbol: 'BNB/USDC', base: 'BNB', price: 950,   change: 0.2,  volume: 1.5e8, high: 960,   low: 940   },
      ];
      setTokens(fallback);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // ── Auto-select initial token and load ─────────────────────────────────────
  useEffect(() => {
    if (tokens.length === 0) return;
    if (selected && selected.base.toUpperCase() === initialSymbol.toUpperCase()) return;
    const init = tokens.find((t) => t.base.toUpperCase() === initialSymbol.toUpperCase()) ?? tokens[0];
    setSelected(init);
  }, [tokens, initialSymbol]);

  // ── Load candles when token or interval changes ────────────────────────────
  useEffect(() => {
    if (!selected) return;
    loadCandles(selected, iv);
  }, [selected?.base, iv, loadCandles]);

  // ── Switch between candle/line ─────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    // lightweight-charts doesn't support switching series type — we just change colors to simulate
    // For a true line toggle, you'd remove the series and add a LineSeries — keeping candle always for accuracy
  }, [chartType]);

  // ── New candle auto-append every interval ─────────────────────────────────
  useEffect(() => {
    const ms = INTERVAL_MS[iv];
    const id = setInterval(() => {
      if (!candleSeriesRef.current || !selected) return;
      const now = Math.floor(Date.now() / 1000) as Time;
      const candleTime = (Math.floor(Date.now() / ms) * Math.floor(ms / 1000)) as Time;
      const price = selected.price;
      candleSeriesRef.current.update({ time: candleTime, open: price, high: price, low: price, close: price });
    }, Math.min(ms, 60_000));
    return () => clearInterval(id);
  }, [iv, selected]);

  // ── Render Trade Setup Price Lines ─────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    
    // Clear old lines
    if (entryLineRef.current) candleSeriesRef.current.removePriceLine(entryLineRef.current);
    if (slLineRef.current) candleSeriesRef.current.removePriceLine(slLineRef.current);
    tpLineRefs.current.forEach(l => candleSeriesRef.current?.removePriceLine(l));
    
    entryLineRef.current = null;
    slLineRef.current = null;
    tpLineRefs.current = [];

    if (tradeSetup) {
      const { entry, sl, tp, side } = tradeSetup;
      
      if (entry > 0) {
        entryLineRef.current = candleSeriesRef.current.createPriceLine({
          price: entry,
          color: '#4f9cff',
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: `ENTRY (${side})`,
        });
      }
      
      if (sl > 0) {
        slLineRef.current = candleSeriesRef.current.createPriceLine({
          price: sl,
          color: '#ff6b6b',
          lineWidth: 2,
          lineStyle: 1, // Dotted
          axisLabelVisible: true,
          title: 'SL',
        });
      }
      
      if (tp && Array.isArray(tp)) {
        tp.forEach((tpVal, idx) => {
          if (tpVal > 0) {
            const line = candleSeriesRef.current?.createPriceLine({
              price: tpVal,
              color: '#2bd9a8',
              lineWidth: 2,
              lineStyle: 1, // Dotted
              axisLabelVisible: true,
              title: `TP${idx+1}`,
            });
            if (line) tpLineRefs.current.push(line);
          }
        });
      }
    }
  }, [tradeSetup]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const selectToken = (t: Token) => {
    setSelected(t);
    setShowSearch(false);
    setSearch('');
    onSymbolChange?.(t.symbol, t.base);
  };

  const changeInterval = (newIv: Interval) => {
    setIv(newIv);
  };

  const filtered = tokens.filter(
    (t) =>
      t.base.toUpperCase().includes(search.toUpperCase()) ||
      t.symbol.toUpperCase().includes(search.toUpperCase()),
  );

  const isUp = (selected?.change ?? 0) >= 0;

  return (
    <div style={{ position: 'relative', background: '#09090f', border: '1px solid #1a1a2e', borderRadius: 16, overflow: 'visible', height, display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #1a1a2e', background: '#0d0d1a', borderRadius: '16px 16px 0 0', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>

        {/* Left: Token picker + price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowSearch((v) => !v); setTimeout(() => searchRef.current?.focus(), 60); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#141425', border: '1px solid #2a2a4a', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: '#fff' }}
            >
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #4f9cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {selected?.base.slice(0, 2) ?? '..'}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em' }}>{selected?.base ?? '…'}/USDC</span>
              <ChevronDown size={12} color="#555" />
            </button>

            {showSearch && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 9999, background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 14, width: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(249,115,22,0.1)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
                  <Search size={13} color="#555" />
                  <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SoDEX pair…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }} />
                  {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, display: 'flex' }}><X size={12} /></button>}
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#444', fontSize: 12 }}>No tokens found</div>}
                  {filtered.slice(0, 50).map((t) => (
                    <button key={t.symbol} onClick={() => selectToken(t)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: selected?.base === t.base ? 'rgba(249,115,22,0.06)' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = selected?.base === t.base ? 'rgba(249,115,22,0.06)' : 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #4f9cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                          {t.base.slice(0, 2)}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: selected?.base === t.base ? '#f97316' : '#fff' }}>{t.base}/USDC</div>
                          <div style={{ fontSize: 10, color: '#444' }}>SoDEX</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>${formatPrice(t.price)}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.change >= 0 ? '#2bd9a8' : '#ff6b6b' }}>{t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Price display */}
          {selected && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>${formatPrice(selected.price)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: isUp ? '#2bd9a8' : '#ff6b6b', display: 'flex', alignItems: 'center', gap: 2 }}>
                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {isUp ? '+' : ''}{selected.change.toFixed(2)}%
              </span>
            </div>
          )}

          {/* 24H stats */}
          {selected && (
            <div style={{ display: 'flex', gap: 14 }}>
              {([['H', selected.high, '#2bd9a8'], ['L', selected.low, '#ff6b6b']] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, color: '#444', fontWeight: 700 }}>24h {l}</span>
                  <span style={{ fontSize: 11, color: c, fontFamily: 'monospace', fontWeight: 700 }}>${formatPrice(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* LIVE badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0f1e12', border: '1px solid #1a3d20', borderRadius: 6, padding: '3px 8px' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#2bd9a8', boxShadow: '0 0 6px #2bd9a8', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 9, color: '#2bd9a8', fontWeight: 900 }}>LIVE</span>
          </div>

          {/* Interval selector */}
          <div style={{ display: 'flex', gap: 1, background: '#111120', padding: 2, borderRadius: 8, border: '1px solid #1e1e3a' }}>
            {INTERVALS.map((i) => (
              <button key={i} onClick={() => changeInterval(i)}
                style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: iv === i ? '#f97316' : 'transparent', color: iv === i ? '#000' : '#555', fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}
              >{i}</button>
            ))}
          </div>

          {/* Chart type */}
          <div style={{ display: 'flex', gap: 1, background: '#111120', padding: 2, borderRadius: 8, border: '1px solid #1e1e3a' }}>
            <button onClick={() => setChartType('candle')} title="Candlestick" style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: chartType === 'candle' ? '#1e1e3a' : 'transparent', color: chartType === 'candle' ? '#fff' : '#555', cursor: 'pointer' }}><BarChart2 size={12} /></button>
            <button onClick={() => setChartType('line')}   title="Line"        style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: chartType === 'line'   ? '#1e1e3a' : 'transparent', color: chartType === 'line'   ? '#fff' : '#555', cursor: 'pointer' }}><Activity  size={12} /></button>
          </div>

          {/* Refresh */}
          <button onClick={() => selected && loadCandles(selected, iv)}
            style={{ background: '#111120', border: '1px solid #1e1e3a', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f97316'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── CHART AREA ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Loading overlay */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10, background: 'rgba(9,9,15,0.85)', borderRadius: '0 0 16px 16px', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: 32, height: 32, border: '2px solid #1a1a2e', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#444', fontWeight: 700, fontFamily: 'monospace' }}>Loading {selected?.base ?? '…'} chart…</span>
          </div>
        )}

        {/* Error state */}
        {fetchError && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <span style={{ fontSize: 12, color: '#ff6b6b', fontWeight: 700 }}>{fetchError}</span>
            <button onClick={() => selected && loadCandles(selected, iv)}
              style={{ padding: '6px 16px', borderRadius: 8, background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >Retry</button>
          </div>
        )}

        {/* Lightweight Charts mount point */}
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%', borderRadius: '0 0 16px 16px', overflow: 'hidden' }} />

        {/* Watermark */}
        <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 10, color: '#1c1c2e', fontWeight: 900, letterSpacing: '.2em', pointerEvents: 'none', userSelect: 'none' }}>SOSO SMRE</div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
      `}</style>
    </div>
  );
});

export default SodexProfessionalChart;
