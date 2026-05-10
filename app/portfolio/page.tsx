'use client';
import { useEffect, useState, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';

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
      if (!user || !db) return;

      setLoading(true);
      const ref = doc(db, 'users', user.uid, 'private', 'portfolio');
      const snap = await getDoc(ref);
      const nextPortfolio = snap.exists() ? { ...DEFAULT, ...snap.data() } as Portfolio : { ...DEFAULT };

      if (!snap.exists()) {
        await setDoc(ref, { ...nextPortfolio, updatedAt: serverTimestamp() });
      }

      setPortfolio(nextPortfolio);
      fetchAnalytics(nextPortfolio);
    };

    load().catch(() => setLoading(false));
  }, [fetchAnalytics, user]);

  // Live PnL Polling
  useEffect(() => {
    if (loading || !user) return;
    const interval = setInterval(() => {
      fetchAnalytics(portfolio);
    }, 15000);
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
          <Wallet size={20} color="#f97316" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Portfolio</h1>
            <p style={{ fontSize: 13, color: '#444', marginTop: 2 }}>Paper trading tracker — starting balance $10,000 USDC</p>
          </div>
        </div>
        <button onClick={() => setConfirmReset(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 8, color: '#f43f5e', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          <RotateCcw size={13} />Reset Portfolio
        </button>
      </div>

      {/* Reset confirm modal */}
      {confirmReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Reset Portfolio?</h3>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 24 }}>This will clear all trades and reset your USDC balance to $10,000. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2a2a2a', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={reset} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#f43f5e', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'TOTAL VALUE',   value: `$${(analytics?.totalValue ?? portfolio.usdc).toLocaleString('en-US',{maximumFractionDigits:2})}`, color: '#fff' },
          { label: 'TOTAL PNL',     value: `${pnlPos?'+':''}$${(analytics?.totalPnl ?? 0).toFixed(2)}`,  color: pnlPos ? '#00e676' : '#f43f5e' },
          { label: 'USDC BALANCE',  value: `$${portfolio.usdc.toLocaleString('en-US',{maximumFractionDigits:2})}`, color: '#fff' },
          { label: 'SOPOINTS',      value: String(portfolio.soPoints ?? 0), color: '#f97316' },
        ].map(c => (
          <div key={c.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Holdings table */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Holdings</span>
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
                  <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                    {['Asset','Amount','Avg Price','Current','Value','PnL'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics?.holdings.map(h => (
                    <tr key={h.symbol} style={{ borderBottom: '1px solid #111' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f7931a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#000' }}>{h.symbol[0]}</div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{h.symbol}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{h.amount.toFixed(6)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#666', fontFamily: 'monospace' }}>${h.avgBuyPrice.toFixed(2)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>${h.currentPrice.toFixed(2)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>${h.currentValue.toFixed(2)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {h.pnl >= 0 ? <TrendingUp size={12} color="#00e676" /> : <TrendingDown size={12} color="#f43f5e" />}
                          <span style={{ fontSize: 12, fontWeight: 700, color: h.pnl >= 0 ? '#00e676' : '#f43f5e', fontFamily: 'monospace' }}>
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

        {/* Trade history */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Trade History</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 12px' }}>
            {portfolio.trades.length === 0 ? (
              <div style={{ padding: '40px 12px', textAlign: 'center', color: '#333', fontSize: 13 }}>No trades yet</div>
            ) : portfolio.trades.slice(0, 50).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: t.type === 'BUY' ? 'rgba(0,230,118,0.15)' : 'rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.type === 'BUY' ? <TrendingUp size={12} color="#00e676" /> : <TrendingDown size={12} color="#f43f5e" />}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc' }}>{t.type} {t.symbol}</div>
                    <div style={{ fontSize: 10, color: '#444' }}>{new Date(t.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>${t.total.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>@${t.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
