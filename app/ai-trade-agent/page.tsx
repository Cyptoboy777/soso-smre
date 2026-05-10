'use client';
import { useState, useEffect, useCallback } from 'react';
import { Info, CheckCircle } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';

interface Holding { symbol: string; amount: number; avgBuyPrice: number; }
interface Trade { id: string; symbol: string; type: 'BUY'|'SELL'; amount: number; price: number; total: number; timestamp: number; }
interface Portfolio { usdc: number; holdings: Record<string,Holding>; trades: Trade[]; initialBalance: number; soPoints: number; }
interface HoldingAnalytic extends Holding { currentPrice: number; currentValue: number; pnl: number; pnlPct: number; }
interface Analytics { totalValue: number; holdingsValue: number; totalPnl: number; totalPnlPct: number; holdings: HoldingAnalytic[]; }

const DEFAULT_PORTFOLIO: Portfolio = { usdc: 10000, holdings: {}, trades: [], initialBalance: 10000, soPoints: 0 };
const ASSETS = ['BTC / USDC','ETH / USDC','SOL / USDC','BNB / USDC','XRP / USDC','AVAX / USDC','SOSO / USDC'];

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 4500); return () => clearTimeout(id); }, [onClose]);
  return (
    <div className="toast-in" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
      <CheckCircle size={18} color="#00e676" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4 }}>{msg}</span>
    </div>
  );
}

export default function AITradeAgentPage() {
  const { user } = useAuth();
  const [asset, setAsset] = useState('BTC / USDC');
  const [amount, setAmount] = useState('1000');
  const [limitPrice, setLimitPrice] = useState('77500');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('90000');
  const [tradeStatus, setTradeStatus] = useState<'IDLE'|'SUBMITTING'|'SUCCESS'>('IDLE');
  const [toast, setToast] = useState('');
  const [portfolio, setPortfolio] = useState<Portfolio>({ ...DEFAULT_PORTFOLIO });
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [news, setNews] = useState<Array<{ title: string; source: string; time: string; url: string }>>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  // AI Agent State
  const [aiActive, setAiActive] = useState(false);
  const [aiLogs, setAiLogs] = useState<string[]>(['SOSO AI-Trader initialized. Engine ready.']);
  const [strategy, setStrategy] = useState('Momentum + Sentiment');
  const [risk, setRisk] = useState('Medium');

  useEffect(() => {
    if (!aiActive) return;
    const phrases = [
      `Analyzing ${asset.split(' / ')[0]} orderbook depth...`,
      `Cross-referencing SoSoValue news sentiment...`,
      `Extracting dynamic features from recent klines...`,
      `Strategy [${strategy}] indicates neutral momentum.`,
      `Awaiting optimal entry condition under ${risk} risk profile...`,
      `Volatility detected. Re-evaluating risk metrics...`,
      `Signal confidence at 84%. Evaluating paper trade...`
    ];
    let i = 0;
    const interval = setInterval(() => {
      setAiLogs(prev => {
        const next = [...prev, phrases[i % phrases.length]];
        if (next.length > 15) next.shift();
        return next;
      });
      i++;
    }, 3000);
    return () => clearInterval(interval);
  }, [aiActive, asset, strategy, risk]);

  const baseCoin = asset.split(' / ')[0];

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
  }, []);

  useEffect(() => {
    const loadPortfolio = async () => {
      if (!user || !db) return;

      const ref = doc(db, 'users', user.uid, 'private', 'portfolio');
      const snap = await getDoc(ref);
      const nextPortfolio = snap.exists() ? { ...DEFAULT_PORTFOLIO, ...snap.data() } as Portfolio : { ...DEFAULT_PORTFOLIO };

      if (!snap.exists()) {
        await setDoc(ref, { ...nextPortfolio, updatedAt: serverTimestamp() });
      }

      setPortfolio(nextPortfolio);
      setPortfolioLoaded(true);
      fetchAnalytics(nextPortfolio);
    };

    loadPortfolio().catch(() => setPortfolioLoaded(true));
    fetch('/api/news').then(r => r.json()).then((d: { news?: typeof news }) => { if (d.news) setNews(d.news.slice(0, 2)); }).catch(() => {});
  }, [user, fetchAnalytics]);

  // Live PnL Polling
  useEffect(() => {
    if (!portfolioLoaded || !user) return;
    const interval = setInterval(() => {
      fetchAnalytics(portfolio);
    }, 15000);
    return () => clearInterval(interval);
  }, [portfolioLoaded, portfolio, user, fetchAnalytics]);

  // Fetch live price when asset changes
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const r = await fetch('/api/prices');
        const d = await r.json() as { prices: Array<{ symbol: string; price: string }> };
        const found = d.prices?.find(p => p.symbol === baseCoin + 'USDT');
        if (found) {
          setLimitPrice(parseFloat(found.price).toString());
          setLivePrice(parseFloat(found.price));
        }
      } catch {}
    };
    fetchPrice();
  }, [baseCoin]);

  // Read query parameters from AI Analysis redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pAsset = params.get('asset');
    const pStopLoss = params.get('stopLoss');
    const pTarget = params.get('target');

    if (pAsset) {
      const match = ASSETS.find(a => a.startsWith(pAsset.toUpperCase()));
      if (match) setAsset(match);
    }
    if (pStopLoss) setStopLoss(pStopLoss);
    if (pTarget) setTakeProfit(pTarget);
  }, []);

  const setPct = (pct: number) => {
    const maxUsdc = portfolio.usdc * pct / 100;
    setAmount(maxUsdc.toFixed(0));
  };

  const confirmBuy = useCallback(async (overrideAmount?: string | React.MouseEvent) => {
    const amtStr = typeof overrideAmount === 'string' ? overrideAmount : amount;
    const tradeAmount = parseFloat(amtStr);
    const price = parseFloat(limitPrice) || livePrice || 78000;
    if (!tradeAmount || tradeAmount <= 0) { setToast('Enter a valid amount'); return; }
    if (tradeAmount > portfolio.usdc) { setToast(`Insufficient USDC. Balance: $${portfolio.usdc.toFixed(2)}`); return; }

    setTradeStatus('SUBMITTING');

    try {
      // Validate on server
      const r = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: baseCoin, type: 'BUY', amount: tradeAmount / price, price, availableUsdc: portfolio.usdc }),
      });
      const d = await r.json() as { success?: boolean; trade?: Trade; soPointsEarned?: number; error?: string };
      if (!r.ok || d.error) { setToast(d.error ?? 'Trade failed'); setTradeStatus('IDLE'); return; }

      if (d.trade) {
        setTradeStatus('SUCCESS');
        setTimeout(() => setTradeStatus('IDLE'), 2000);
        const p = { ...portfolio };
        p.usdc = Math.max(0, p.usdc - tradeAmount);
        if (!p.holdings[baseCoin]) {
          p.holdings[baseCoin] = { symbol: baseCoin, amount: 0, avgBuyPrice: price };
        }
        const h = p.holdings[baseCoin];
        const newTotal = h.amount + d.trade.amount;
        h.avgBuyPrice = (h.amount * h.avgBuyPrice + d.trade.total) / newTotal;
        h.amount = newTotal;
        if (!p.trades) p.trades = [];
        p.trades.unshift(d.trade);
        p.soPoints = (p.soPoints ?? 0) + (d.soPointsEarned ?? 0);
        if (user && db) {
          await setDoc(doc(db, 'users', user.uid, 'private', 'portfolio'), { ...p, updatedAt: serverTimestamp() });
        }
        setPortfolio(p);
        fetchAnalytics(p);
        setToast(`Order filled: Simulated paper trade: BUY ${baseCoin} for $${tradeAmount.toLocaleString()}`);
        setAmount('0.00');
      }
    } catch { setToast('Network error. Try again.'); setTradeStatus('IDLE'); }
  }, [amount, limitPrice, livePrice, portfolio, baseCoin]);

  const displayHoldings = analytics?.holdings ?? Object.values(portfolio.holdings ?? {}).map(h => ({ ...h, currentPrice: h.avgBuyPrice, currentValue: h.amount * h.avgBuyPrice, pnl: 0, pnlPct: 0 }));
  const totalValue = analytics?.totalValue ?? (portfolio.usdc + displayHoldings.reduce((s, h) => s + h.amount * h.avgBuyPrice, 0));

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* LEFT: Trading Interfaces */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* MANUAL TRADE SETUP */}
          <div style={{ flex: 1, minWidth: 320, maxWidth: 500, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 16, padding: 20 }}>
            <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '.05em' }}>MANUAL TRADE SETUP</h2>
            </div>

          {/* Asset + Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 8 }}>ASSET SELECTION</label>
              <select value={asset} onChange={e => { setAsset(e.target.value); }} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 14, fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                {ASSETS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '.1em' }}>TRADE AMOUNT (USDC)</label>
                <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>Balance: ${portfolio.usdc.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 14, outline: 'none' }} />
                <div style={{ display: 'flex', gap: 4 }}>
                  {['25%', '50%', 'MAX'].map((p, i) => (
                    <button key={p} onClick={() => setPct(i === 0 ? 25 : i === 1 ? 50 : 100)} style={{ padding: '0 8px', borderRadius: 6, background: '#161616', border: '1px solid #2a2a2a', color: '#888', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Limit Price, Stop Loss, Take Profit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'LIMIT PRICE (ENTRY)', suffix: '↗', suffixColor: '#f97316', val: limitPrice, set: setLimitPrice, ph: '77500' },
              { label: 'STOP-LOSS', suffix: '↘', suffixColor: '#f43f5e', val: stopLoss, set: setStopLoss, ph: 'Optional' },
              { label: 'TAKE-PROFIT', suffix: '↗', suffixColor: '#00e676', val: takeProfit, set: setTakeProfit, ph: 'Optional' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  {f.label} <span style={{ color: f.suffixColor }}>{f.suffix}</span>
                </label>
                <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: f.val ? '#fff' : '#555', fontSize: 14, outline: 'none' }} />
              </div>
            ))}
          </div>

          {/* Info */}
          <div style={{ display: 'flex', gap: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
            <Info size={15} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#666', lineHeight: 1.55 }}>Orders are executed as Market Orders on the SoSo Smre Testnet. Stop-Loss and Take-Profit orders will be triggered automatically when the terminal price crosses the target.</p>
          </div>

          {/* Confirm Buy */}
          <button onClick={confirmBuy} disabled={tradeStatus !== 'IDLE' || !portfolioLoaded} style={{ width: '100%', padding: 16, borderRadius: 12, background: tradeStatus === 'SUBMITTING' ? '#0a2a0a' : tradeStatus === 'SUCCESS' ? '#00e676' : 'linear-gradient(90deg,#00c853,#00e676)', color: tradeStatus === 'SUBMITTING' ? '#00e676' : '#000', border: tradeStatus === 'SUBMITTING' ? '1px solid #00e67630' : 'none', fontSize: 15, fontWeight: 800, letterSpacing: '.06em', cursor: tradeStatus !== 'IDLE' || !portfolioLoaded ? 'not-allowed' : 'pointer', opacity: portfolioLoaded ? 1 : 0.5, boxShadow: tradeStatus !== 'IDLE' ? 'none' : '0 0 28px rgba(0,230,118,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
            {tradeStatus === 'SUBMITTING' ? <span className="spin" style={{ display: 'inline-block', fontSize: 18 }}>⟳</span> : null}
            {tradeStatus === 'SUCCESS' ? <CheckCircle size={18} color="#000" /> : null}
            {tradeStatus === 'SUCCESS' ? 'PURCHASED' : `CONFIRM BUY ${baseCoin}`}
          </button>
          </div>

          {/* AI TRADING AGENT (SOSO Inspired) */}
          <div style={{ flex: 1, minWidth: 320, maxWidth: 500, background: 'linear-gradient(180deg, #0a101d 0%, #050505 100%)', border: '1px solid #1e293b', borderRadius: 16, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 8, margin: 0, letterSpacing: '.05em' }}>
                <div className={aiActive ? 'pulse-blob' : ''} style={{ width: 8, height: 8, borderRadius: '50%', background: aiActive ? '#3b82f6' : '#4b5563', boxShadow: aiActive ? '0 0 10px #3b82f6' : 'none', transition: 'all 0.3s' }} />
                SOSO AI-TRADER
              </h2>
              <div style={{ fontSize: 9, color: '#94a3b8', background: '#0f172a', padding: '4px 8px', borderRadius: 6, fontWeight: 700, border: '1px solid #1e293b' }}>v2.4 LLM ENGINE</div>
            </div>

            {/* AI Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 8 }}>STRATEGY MODEL</label>
                <select value={strategy} onChange={e => setStrategy(e.target.value)} disabled={aiActive} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #1e293b', color: '#e2e8f0', fontSize: 13, outline: 'none', cursor: aiActive ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  <option>Momentum + Sentiment</option>
                  <option>Mean Reversion</option>
                  <option>Macro-Trend Following</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '.1em', display: 'block', marginBottom: 8 }}>RISK TOLERANCE</label>
                <select value={risk} onChange={e => setRisk(e.target.value)} disabled={aiActive} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #1e293b', color: '#e2e8f0', fontSize: 13, outline: 'none', cursor: aiActive ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  <option>Low (Preservation)</option>
                  <option>Medium (Balanced)</option>
                  <option>High (Aggressive)</option>
                </select>
              </div>
            </div>

            {/* Terminal / Logs */}
            <div style={{ background: '#020617', border: '1px solid #0f172a', borderRadius: 10, padding: 14, height: 210, overflowY: 'auto', marginBottom: 20, fontFamily: 'monospace', fontSize: 11, color: '#38bdf8', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
              {aiLogs.map((log, i) => (
                <div key={i} style={{ opacity: i === aiLogs.length - 1 ? 1 : 0.6, lineHeight: 1.4 }}>
                  <span style={{ color: '#475569', marginRight: 6 }}>[{new Date().toLocaleTimeString()}]</span>
                  {log}
                </div>
              ))}
              {aiActive && <div className="blink" style={{ width: 6, height: 12, background: '#38bdf8', marginTop: 4 }} />}
            </div>

            <button onClick={() => {
              if (aiActive) { setAiActive(false); return; }
              setAiActive(true);
              setAiLogs(prev => {
                const next = [...prev, `[AI] Autonomous execution initiated...`, `[AI] Scanning ${baseCoin} risk parameters...`];
                if (next.length > 15) return next.slice(next.length - 15);
                return next;
              });
              
              const pct = risk.startsWith('Low') ? 0.25 : risk.startsWith('Medium') ? 0.5 : 1.0;
              const maxUsdc = portfolio.usdc * pct;
              const amtStr = maxUsdc.toFixed(0);
              
              // 1. Auto-fill manual trade setup
              setAmount(amtStr);
              
              // 2. Automatically confirm buy after a brief simulated "thinking" delay
              setTimeout(() => {
                setAiLogs(prev => {
                  const next = [...prev, `[AI] Strategy confirmed. Executing ${pct * 100}% allocation Market Order.`];
                  if (next.length > 15) return next.slice(next.length - 15);
                  return next;
                });
                confirmBuy(amtStr);
                
                // Return to idle state after execution
                setTimeout(() => setAiActive(false), 2500);
              }, 1500);

            }} style={{ width: '100%', padding: 16, borderRadius: 12, background: aiActive ? 'transparent' : 'linear-gradient(90deg,#2563eb,#3b82f6)', color: aiActive ? '#ef4444' : '#fff', border: aiActive ? '1px solid #ef4444' : 'none', fontSize: 14, fontWeight: 800, letterSpacing: '.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', boxShadow: aiActive ? 'none' : '0 0 20px rgba(59,130,246,0.4)' }}>
              {aiActive ? 'STOP AUTONOMOUS AGENT' : 'START AI TRADER'}
            </button>
          </div>

        </div>
      </div>

      {/* RIGHT: Portfolio + News */}
      <div style={{ width: 340, background: '#0d0d0d', borderLeft: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
        {/* News */}
        <div style={{ padding: '16px 16px 0' }}>
          {news.map((n, i) => (
            <div key={i} onClick={() => window.open(n.url, '_blank')} style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: 12, marginBottom: 12, cursor: 'pointer' }}>
              <p style={{ fontSize: 11, color: '#555', lineHeight: 1.5, marginBottom: 4 }}>{n.title?.slice(0, 95)}{(n.title?.length ?? 0) > 95 ? '...' : ''}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 9, color: '#f97316', fontWeight: 700 }}>{n.source}</span>
                <span style={{ fontSize: 9, color: '#333' }}>{n.time?.slice(0, 8) ?? ''}</span>
              </div>
            </div>
          ))}
        </div>

        {/* LIVE PORTFOLIO SIMULATION */}
        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '.04em' }}>LIVE PORTFOLIO SIMULATION</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div className="sync" style={{ width: 7, height: 7, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 5px #00e676' }} />
              <span style={{ fontSize: 10, color: '#00e676', fontWeight: 600, letterSpacing: '.08em' }}>SYNCING</span>
            </div>
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1.2fr 1fr', borderBottom: '1px solid #1e1e1e', paddingBottom: 8, marginBottom: 4 }}>
            {['ASSET','BALANCE','VALUE','PNL'].map(h => (
              <span key={h} style={{ fontSize: 9, color: '#333', fontWeight: 700, letterSpacing: '.1em' }}>{h}</span>
            ))}
          </div>

          {/* Dynamic holdings */}
          {displayHoldings.map((h, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1.2fr 1fr', padding: '10px 0', borderBottom: '1px solid #111', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#f7931a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#000' }}>{h.symbol[0]}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{h.symbol}</span>
              </div>
              <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{h.amount.toFixed(4)}</span>
              <span style={{ fontSize: 11, color: '#fff', fontFamily: 'monospace' }}>${h.currentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              <span style={{ fontSize: 11, color: h.pnl >= 0 ? '#00e676' : '#f43f5e', fontWeight: 600 }}>
                {h.pnl >= 0 ? '↗' : '↘'} {h.pnl >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
              </span>
            </div>
          ))}

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '.08em' }}>TOTAL VALUE</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  );
}
