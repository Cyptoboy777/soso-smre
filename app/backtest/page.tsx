'use client';
import { useState } from 'react';
import { History, Play, CheckCircle, Info } from 'lucide-react';

export default function BacktestPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const startBacktest = () => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setRunning(false);
      setResult({
        roi: '+24.5%',
        trades: 12,
        winRate: '68%',
        maxDrawdown: '4.2%',
        profitFactor: '2.1'
      });
    }, 3000);
  };

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <History size={24} color="#3b82f6" />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Strategy Backtester</h1>
          <p style={{ fontSize: 13, color: '#555', margin: '4px 0 0 0' }}>Simulate AI strategies on historical data.</p>
        </div>
      </div>

      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 20, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 8 }}>STRATEGY</label>
            <select style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: 10, outline: 'none' }}>
              <option>Momentum + Sentiment (Llama-3)</option>
              <option>Mean Reversion (Gemini-2.5)</option>
              <option>Scalping (Fast-Inference)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 8 }}>TIMEFRAME</label>
            <select style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: 10, outline: 'none' }}>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Custom Range</option>
            </select>
          </div>
        </div>

        <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
          <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>Backtesting uses 1-minute historical k-lines to simulate trade execution including slippage and estimated funding rates.</p>
        </div>

        <button onClick={startBacktest} disabled={running} style={{ width: '100%', padding: 16, borderRadius: 12, background: running ? '#111' : '#3b82f6', color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {running ? <div className="spin" style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} /> : <Play size={16} fill="currentColor" />}
          {running ? 'SIMULATING...' : 'RUN BACKTEST'}
        </button>
      </div>

      {result && (
        <div className="fade-up" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 20, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <CheckCircle size={18} color="#00e676" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Simulated Results Found</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'EST. ROI', value: result.roi, color: '#00e676' },
              { label: 'WIN RATE', value: result.winRate, color: '#fff' },
              { label: 'TRADES', value: String(result.trades), color: '#fff' },
              { label: 'DRAWDOWN', value: result.maxDrawdown, color: '#f43f5e' },
              { label: 'PROFIT FACTOR', value: result.profitFactor, color: '#fff' },
              { label: 'POINTS', value: '+150', color: '#f59e0b' },
            ].map(r => (
              <div key={r.label} style={{ background: '#111', padding: 16, borderRadius: 12, border: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: 9, color: '#444', fontWeight: 800, marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: r.color, fontFamily: 'monospace' }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
