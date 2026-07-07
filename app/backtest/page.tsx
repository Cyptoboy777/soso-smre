'use client';
import { useState, useEffect } from 'react';
import { History, Play, CheckCircle, Info, TrendingUp, TrendingDown } from 'lucide-react';

interface Trade { id: string; symbol: string; type: 'BUY'|'SELL'; amount: number; price: number; total: number; timestamp: number; pnl?: number; }
interface Portfolio { usdc: number; holdings: Record<string,{symbol:string;amount:number;avgBuyPrice:number}>; trades: Trade[]; initialBalance: number; }

function computeBacktest(trades: Trade[], initialBalance: number) {
  if (!trades || trades.length === 0) return null;

  // Pair BUY → SELL trades per symbol to compute realized PnL
  const buys: Record<string, { price: number; total: number; timestamp: number }[]> = {};
  let realizedPnl = 0;
  let wins = 0;
  let losses = 0;
  let maxDrawdown = 0;
  let peak = initialBalance;
  let runningBalance = initialBalance;

  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  for (const t of sorted) {
    if (t.type === 'BUY') {
      if (!buys[t.symbol]) buys[t.symbol] = [];
      buys[t.symbol].push({ price: t.price, total: t.total, timestamp: t.timestamp });
      runningBalance -= t.total;
    } else if (t.type === 'SELL') {
      const queue = buys[t.symbol] || [];
      if (queue.length > 0) {
        const buy = queue.shift()!;
        const priceDiff = t.price - buy.price;
        const pnl = (priceDiff / buy.price) * buy.total;
        realizedPnl += pnl;
        runningBalance += t.total + pnl;
        if (pnl > 0) wins++; else losses++;
      } else {
        runningBalance += t.total;
      }
      if (runningBalance > peak) peak = runningBalance;
      const dd = ((peak - runningBalance) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  const totalTrades = trades.length;
  const completedTrades = wins + losses;
  const winRate = completedTrades > 0 ? Math.round((wins / completedTrades) * 100) : 0;
  const roi = ((realizedPnl / initialBalance) * 100).toFixed(2);
  const profitFactor = losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? '∞' : '0';

  // Trading Score: composite of winRate + roi + trade frequency
  const roiScore = Math.min(Math.max(parseFloat(roi) * 2, -50), 50); // ±50 pts
  const winScore = winRate * 0.4; // 0-40 pts
  const activityScore = Math.min(totalTrades * 1.5, 10); // 0-10 pts
  const tradingScore = Math.round(Math.max(0, Math.min(100, 50 + roiScore + winScore * 0.2 + activityScore)));

  return {
    roi: `${parseFloat(roi) >= 0 ? '+' : ''}${roi}%`,
    roiValue: parseFloat(roi),
    totalTrades,
    completedTrades,
    winRate: `${winRate}%`,
    maxDrawdown: `${maxDrawdown.toFixed(2)}%`,
    profitFactor: String(profitFactor),
    tradingScore,
    wins,
    losses,
    realizedPnl,
  };
}

export default function BacktestPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof computeBacktest>>(null);
  const [tradeCount, setTradeCount] = useState(0);
  const [strategy, setStrategy] = useState('Momentum + Sentiment (Llama-3)');
  const [timeframe, setTimeframe] = useState('Last 7 Days');

  // Load trade count on mount so user knows data exists
  useEffect(() => {
    try {
      const raw = localStorage.getItem('soso_paper_portfolio');
      if (raw) {
        const p: Portfolio = JSON.parse(raw);
        setTradeCount(p.trades?.length ?? 0);
      }
    } catch {}
  }, []);

  const startBacktest = () => {
    setRunning(true);
    setResult(null);

    setTimeout(() => {
      try {
        const raw = localStorage.getItem('soso_paper_portfolio');
        if (!raw) { setRunning(false); return; }
        const p: Portfolio = JSON.parse(raw);

        let trades = p.trades ?? [];

        // Filter by timeframe
        const now = Date.now();
        const ms: Record<string, number> = {
          'Last 7 Days': 7 * 86400000,
          'Last 30 Days': 30 * 86400000,
          'All Time': Infinity,
        };
        const cutoff = ms[timeframe] ?? Infinity;
        if (cutoff !== Infinity) {
          trades = trades.filter(t => now - t.timestamp <= cutoff);
        }

        const res = computeBacktest(trades, p.initialBalance ?? 10000);
        setResult(res);
      } catch (e) {
        console.error(e);
      }
      setRunning(false);
    }, 2200);
  };

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <History size={24} color="#3b82f6" />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Strategy Backtester</h1>
          <p style={{ fontSize: 13, color: '#555', margin: '4px 0 0 0' }}>Analyzes your actual paper-trading history — real trades, real results.</p>
        </div>
      </div>

      {/* Trade count badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(79,156,255,0.06)', border: '1px solid rgba(79,156,255,0.15)', borderRadius: 30, marginBottom: 28 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f9cff' }} className="badge-live" />
        <span style={{ fontSize: 11, color: '#4f9cff', fontWeight: 700 }}>{tradeCount} trades found in your portfolio history</span>
      </div>

      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 20, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 8 }}>STRATEGY</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: 10, outline: 'none' }}>
              <option>Momentum + Sentiment (Llama-3)</option>
              <option>Mean Reversion (Gemini-2.5)</option>
              <option>Scalping (Fast-Inference)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 8 }}>TIMEFRAME</label>
            <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: 10, outline: 'none' }}>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>All Time</option>
            </select>
          </div>
        </div>

        <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
          <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
            This backtester reads your <strong style={{ color: '#888' }}>actual executed paper trades</strong> from your portfolio, pairs BUY → SELL orders to compute realized PnL, win rate, and a composite Trading Score.
          </p>
        </div>

        <button onClick={startBacktest} disabled={running || tradeCount === 0}
          style={{ width: '100%', padding: 16, borderRadius: 12, background: running ? '#111' : tradeCount === 0 ? '#0a0a0a' : '#3b82f6', color: tradeCount === 0 ? '#333' : '#fff', border: tradeCount === 0 ? '1px solid #222' : 'none', fontSize: 14, fontWeight: 800, cursor: running || tradeCount === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background 0.2s' }}>
          {running
            ? <><div className="spin" style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />SIMULATING YOUR TRADES...</>
            : tradeCount === 0
              ? <><Info size={16} />NO TRADE HISTORY YET — EXECUTE SOME TRADES FIRST</>
              : <><Play size={16} fill="currentColor" />RUN BACKTEST ON {tradeCount} TRADES</>
          }
        </button>
      </div>

      {result && (
        <div className="fade-up" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 20, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <CheckCircle size={18} color="#2bd9a8" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Backtest Complete — Based on {result.totalTrades} real trades</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'REALIZED ROI', value: result.roi, color: result.roiValue >= 0 ? '#2bd9a8' : '#ff6b6b' },
              { label: 'WIN RATE', value: result.winRate, color: '#fff' },
              { label: 'TOTAL TRADES', value: String(result.totalTrades), color: '#fff' },
              { label: 'MAX DRAWDOWN', value: result.maxDrawdown, color: '#ff6b6b' },
              { label: 'PROFIT FACTOR', value: result.profitFactor, color: '#f59e0b' },
              { label: 'W / L', value: `${result.wins} / ${result.losses}`, color: '#94a3b8' },
            ].map(r => (
              <div key={r.label} style={{ background: '#111', padding: 16, borderRadius: 12, border: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: 9, color: '#444', fontWeight: 800, marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: r.color, fontFamily: 'monospace' }}>{r.value}</div>
              </div>
            ))}
          </div>

          {/* Trading Score (replaces SoPoints) */}
          <div style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(249,115,22,0.02))', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: '#f97316', fontWeight: 900, letterSpacing: '.15em', marginBottom: 6 }}>TRADING SCORE</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: result.tradingScore >= 60 ? '#2bd9a8' : result.tradingScore >= 40 ? '#f59e0b' : '#ff6b6b', lineHeight: 1 }}>
                  {result.tradingScore}
                </span>
                <span style={{ fontSize: 16, color: '#444', fontWeight: 700, marginBottom: 6 }}>/100</span>
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                Composite of ROI, Win Rate & Trade Activity
              </div>
            </div>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke={result.tradingScore >= 60 ? '#2bd9a8' : result.tradingScore >= 40 ? '#f59e0b' : '#ff6b6b'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(result.tradingScore / 100) * 213.6} 213.6`}
                  style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {result.tradingScore >= 60 ? <TrendingUp size={24} color="#2bd9a8" /> : <TrendingDown size={24} color="#ff6b6b" />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
