'use client';
import { useEffect, useState, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, RotateCcw, Mic } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';
import PerformanceChart from '@/components/PerformanceChart';
import Achievements from '@/components/Achievements';
import VoiceBriefing from '@/components/VoiceBriefing';

interface Holding { symbol: string; amount: number; avgBuyPrice: number; }
interface Trade  { id: string; symbol: string; type: 'BUY'|'SELL'; amount: number; price: number; total: number; timestamp: number; }
interface Portfolio { usdc: number; holdings: Record<string,Holding>; trades: Trade[]; initialBalance: number; soPoints: number; }
interface HoldingAnalytic extends Holding { currentPrice: number; currentValue: number; pnl: number; pnlPct: number; }
interface Analytics { totalValue: number; holdingsValue: number; totalPnl: number; totalPnlPct: number; holdings: HoldingAnalytic[]; tradeCount: number; soPoints: number; }

const DEFAULT: Portfolio = { usdc: 10000, holdings: {}, trades: [], initialBalance: 10000, soPoints: 0 };

export default function PortfolioPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio>({ ...DEFAULT });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);

  const fetchAnalytics = useCallback(async (p: Portfolio) => {
    try {
      const r = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio: p }),
      });
      if (r.ok) {
        const d = await r.json() as { analytics: Analytics };
        setAnalytics(d.analytics);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const load = async () => {
      // 1. Instant Local Sync
      const localData = localStorage.getItem('soso_paper_portfolio');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setPortfolio(parsed);
          fetchAnalytics(parsed);
        } catch (e) {}
      }

      if (!user || !db) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const ref = doc(db, 'users', user.uid, 'private', 'portfolio');
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
          const cloudData = { ...DEFAULT, ...snap.data() } as Portfolio;
          // Prefer cloud data if it exists, but save to local
          setPortfolio(cloudData);
          fetchAnalytics(cloudData);
          localStorage.setItem('soso_paper_portfolio', JSON.stringify(cloudData));
        } else {
          // Initialize
          const nextPortfolio = localData ? JSON.parse(localData) : { ...DEFAULT };
          await setDoc(ref, { ...nextPortfolio, updatedAt: serverTimestamp() });
          setPortfolio(nextPortfolio);
          fetchAnalytics(nextPortfolio);
        }
      } catch (err) {
        console.error("Portfolio sync error:", err);
      }
      setLoading(false);
    };

    load();
  }, [fetchAnalytics, user]);

  // Live PnL Polling & Local Sync
  useEffect(() => {
    if (loading || !user) return;
    const interval = setInterval(() => {
      const localData = localStorage.getItem('soso_paper_portfolio');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setPortfolio(parsed);
          fetchAnalytics(parsed);
          return;
        } catch(e) {}
      }
      fetchAnalytics(portfolio);
    }, 5000);
    return () => clearInterval(interval);
  }, [loading, portfolio, user, fetchAnalytics]);

  const reset = async () => {
    if (!user || !db) return;
    const nextPortfolio = { ...DEFAULT };
    await setDoc(doc(db, 'users', user.uid, 'private', 'portfolio'), { ...nextPortfolio, updatedAt: serverTimestamp() });
    setPortfolio(nextPortfolio);
    setConfirmReset(false);
    fetchAnalytics(nextPortfolio);
  };

  const pnlPos = (analytics?.totalPnl ?? 0) >= 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wallet size={20} color="var(--accent-orange)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Portfolio</h1>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>Paper trading tracker — starting balance $10,000 USDC</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#3b82f6', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            <Mic size={13} /> Voice Briefing
          </button>
          <button onClick={() => setConfirmReset(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 8, color: '#f43f5e', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            <RotateCcw size={13} />Reset Portfolio
          </button>
        </div>
      </div>

      {/* Reset confirm modal */}
      {confirmReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="neon-border glass" style={{ borderRadius: 24, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 12 }}>RESET PORTFOLIO?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>This will clear all trades and reset your USDC balance to $10,000. This action is irreversible.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border-bold)', background: 'transparent', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>CANCEL</button>
              <button onClick={reset} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent-red)', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>RESET NOW</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: AI Voice Briefing */}
      <div style={{ marginBottom: 24 }}>
        <VoiceBriefing data={{ ...portfolio, ...analytics }} />
      </div>

      {/* Equity Chart */}
      <PerformanceChart initialBalance={portfolio.initialBalance} currentValue={analytics?.totalValue ?? portfolio.usdc} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'TOTAL VALUE',   value: `$${(analytics?.totalValue ?? portfolio.usdc).toLocaleString('en-US',{maximumFractionDigits:2})}`, color: 'var(--text-primary)' },
          { label: 'TOTAL PNL',     value: `${pnlPos?'+':''}$${(analytics?.totalPnl ?? 0).toFixed(2)}`,  color: pnlPos ? 'var(--accent-green)' : 'var(--accent-red)' },
          { label: 'USDC BALANCE',  value: `$${portfolio.usdc.toLocaleString('en-US',{maximumFractionDigits:2})}`, color: 'var(--text-primary)' },
        ].map(c => (
          <div key={c.label} className="neon-border glass" style={{ borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Left column: Holdings + Achievements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Holdings table */}
          <div className="neon-border glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Holdings</span>
            </div>
            {loading ? (
              <div style={{ padding: 24 }}>
                {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 44, marginBottom: 8 }} />)}
              </div>
            ) : (analytics?.holdings ?? []).length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#333', fontSize: 13 }}>
                No holdings yet.{' '}
                <a href="/ai-trade-agent" style={{ color: '#f97316' }}>Go trade →</a>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Asset','Amount','Avg Price','Current','Value','PnL'].map(h => (
                        <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.holdings.map(h => (
                      <tr key={h.symbol} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>{h.symbol[0]}</div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{h.symbol}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{h.amount.toFixed(6)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>${h.avgBuyPrice.toFixed(2)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 700 }}>${h.currentPrice.toFixed(2)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 700 }}>${h.currentValue.toFixed(2)}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {h.pnl >= 0 ? <TrendingUp size={14} color="var(--accent-green)" /> : <TrendingDown size={14} color="var(--accent-red)" />}
                            <span style={{ fontSize: 12, fontWeight: 900, color: h.pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'monospace' }}>
                              {h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)} ({h.pnlPct.toFixed(2)}%)
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Achievements soPoints={portfolio.soPoints} tradeCount={portfolio.trades.length} />
        </div>

        {/* Trade history (Right Sidebar) */}
        <div className="neon-border glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Trade History</span>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto', padding: '8px 16px' }}>
            {portfolio.trades.length === 0 ? (
              <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>No trades yet</div>
            ) : portfolio.trades.slice(0, 50).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: t.type === 'BUY' ? 'rgba(0,230,118,0.1)' : 'rgba(244,63,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.type === 'BUY' ? <TrendingUp size={14} color="var(--accent-green)" /> : <TrendingDown size={14} color="var(--accent-red)" />}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{t.type} {t.symbol}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{new Date(t.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>${t.total.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', fontWeight: 600 }}>@${t.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
