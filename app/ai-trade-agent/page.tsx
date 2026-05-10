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
  const [tradeMode, setTradeMode] = useState<'SPOT' | 'FUTURES'>('SPOT');
  const [leverage, setLeverage] = useState(10);
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');

  // AI Agent State
  const [aiActive, setAiActive] = useState(false);
  const [aiLogs, setAiLogs] = useState<string[]>(['SOSO AI-Trader initialized. Engine ready.']);
  const [strategy, setStrategy] = useState('Momentum + Sentiment');
  const [risk, setRisk] = useState('Medium');

  const baseCoin = asset.split(' / ')[0];

  // 🤖 GENIUS AUTO-TRADER LOOP
  useEffect(() => {
    if (!aiActive || !portfolioLoaded) return;

    const runGeniusTrade = async () => {
      setAiLogs(prev => [...prev.slice(-15), `[AI] Analyzing ${baseCoin} market structure...`]);
      
      try {
        // 1. Get real-time AI signal
        const r = await fetch('/api/ai-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: baseCoin, riskProfile: risk, timeframe: '1H' }),
        });
        const d = await r.json();
        
        if (d.signal) {
          const s = d.signal;
          setAiLogs(prev => [...prev.slice(-15), `[AI] Signal: ${s.signal} | Confidence: ${s.confidence}%`]);

          // 2. Logic: Only trade if confidence > 80% (Genius Threshold)
          if (s.confidence >= 80) {
            if (s.signal === 'BUY') {
              const allocation = risk.includes('High') ? 1.0 : risk.includes('Medium') ? 0.5 : 0.25;
              const tradeAmt = (portfolio.usdc * allocation).toFixed(0);
              setAiLogs(prev => [...prev.slice(-15), `[AI] High confidence detected. Executing BUY for $${tradeAmt}...`]);
              await confirmBuy(tradeAmt);
            }
          } else {
            setAiLogs(prev => [...prev.slice(-15), `[AI] Confidence too low (${s.confidence}%). Standing by...`]);
          }
        }
      } catch (e) {
        setAiLogs(prev => [...prev.slice(-15), `[AI] Analysis failed. Retrying in next cycle.`]);
      }
    };

    // Initial run
    runGeniusTrade();
    
    // Interval run every 30 seconds
    const id = setInterval(runGeniusTrade, 30000);
    return () => clearInterval(id);
  }, [aiActive, portfolioLoaded, baseCoin, risk, portfolio.usdc]);

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
      // 1. Instant Local Storage Fallback (Zero Latency Paper Trading)
      const localData = localStorage.getItem('soso_paper_portfolio');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setPortfolio(parsed);
          setPortfolioLoaded(true);
          fetchAnalytics(parsed);
        } catch (e) {}
      }

      if (!user || !db) {
        setPortfolioLoaded(true); // Allow trading even without auth
        return;
      }

      // 2. Cloud Sync (Permanent Storage)
      try {
        const ref = doc(db, 'users', user.uid, 'private', 'portfolio');
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
          const cloudData = { ...DEFAULT_PORTFOLIO, ...snap.data() } as Portfolio;
          setPortfolio(cloudData);
          setPortfolioLoaded(true);
          fetchAnalytics(cloudData);
          localStorage.setItem('soso_paper_portfolio', JSON.stringify(cloudData));
        } else {
          // Initialize new cloud portfolio
          await setDoc(ref, { ...(localData ? JSON.parse(localData) : DEFAULT_PORTFOLIO), updatedAt: serverTimestamp() });
          setPortfolioLoaded(true);
        }
      } catch (err) {
        console.error("Firebase Sync Failed, using local session:", err);
        setPortfolioLoaded(true);
      }
    };

    loadPortfolio();
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
    
    // In Futures, margin is tradeAmount / leverage
    const marginRequired = tradeMode === 'FUTURES' ? tradeAmount / leverage : tradeAmount;
    if (marginRequired > portfolio.usdc) { setToast(`Insufficient USDC. Required Margin: $${marginRequired.toFixed(2)}`); return; }

    setTradeStatus('SUBMITTING');
    console.log("[TRADE] Initiating...", { baseCoin, tradeAmount, tradeMode, side, leverage });

    try {
      const type = tradeMode === 'SPOT' ? 'BUY' : side;
      const r = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol: baseCoin, 
          type, 
          amount: (tradeAmount * (tradeMode === 'FUTURES' ? leverage : 1)) / price, 
          price, 
          availableUsdc: portfolio.usdc,
          tradeMode,
          leverage: tradeMode === 'FUTURES' ? leverage : 1
        }),
      });
      
      const d = await r.json();
      console.log("[TRADE] API Response:", d);

      if (!r.ok || d.error) { 
        setToast(d.error ?? 'Order rejected by engine'); 
        setTradeStatus('IDLE'); 
        return; 
      }

      if (d.trade) {
        setTradeStatus('SUCCESS');
        
        setPortfolio(prev => {
          const next = { 
            ...prev, 
            usdc: Math.max(0, prev.usdc - marginRequired),
            holdings: { ...prev.holdings },
            trades: [d.trade!, ...(prev.trades ?? [])],
            soPoints: (prev.soPoints ?? 0) + (d.soPointsEarned ?? 0)
          };

          if (tradeMode === 'SPOT') {
            const h = next.holdings[baseCoin] ? { ...next.holdings[baseCoin] } : { symbol: baseCoin, amount: 0, avgBuyPrice: price };
            const newTotal = h.amount + d.trade!.amount;
            h.avgBuyPrice = (h.amount * h.avgBuyPrice + d.trade!.total) / newTotal;
            h.amount = newTotal;
            next.holdings[baseCoin] = h;
          }

          // INSTANT LOCAL SAVE (Perfect Paper Trading)
          localStorage.setItem('soso_paper_portfolio', JSON.stringify(next));

          // CLOUD BACKUP
          if (user && db) {
            const ref = doc(db, 'users', user.uid, 'private', 'portfolio');
            setDoc(ref, { ...next, updatedAt: serverTimestamp() }).catch(e => console.error("Cloud Sync Delayed:", e));
          }

          fetchAnalytics(next);
          return next;
        });

        const tradeMsg = tradeMode === 'SPOT' ? `BUY ${baseCoin}` : `${side} ${baseCoin} ${leverage}x`;
        setToast(`Order filled: ${tradeMsg} for $${tradeAmount.toLocaleString()}`);
        setAmount('0.00');
        setTimeout(() => setTradeStatus('IDLE'), 2000);
      }
    } catch (err) { 
      console.error("[TRADE] Execution Error:", err);
      setToast('Network Error: Unable to reach trade engine.'); 
      setTradeStatus('IDLE'); 
    }
  }, [amount, limitPrice, livePrice, portfolio.usdc, baseCoin, user, fetchAnalytics, tradeMode, leverage, side]);

  const displayHoldings = analytics?.holdings ?? Object.values(portfolio.holdings ?? {}).map(h => ({ ...h, currentPrice: h.avgBuyPrice, currentValue: h.amount * h.avgBuyPrice, pnl: 0, pnlPct: 0 }));
  const totalValue = analytics?.totalValue ?? (portfolio.usdc + displayHoldings.reduce((s, h) => s + h.amount * h.avgBuyPrice, 0));

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* LEFT: Trading Interfaces */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* MANUAL TRADE SETUP */}
          <div style={{ flex: 1, minWidth: 320, maxWidth: 500, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 16, padding: 20 }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '.12em' }}>TERMINAL EXECUTION</h2>
              <div style={{ display: 'flex', background: 'var(--bg-main)', padding: 3, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                {['SPOT', 'FUTURES'].map(m => (
                  <button 
                    key={m} 
                    onClick={() => setTradeMode(m as any)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: tradeMode === m ? 'var(--bg-card)' : 'transparent', color: tradeMode === m ? 'var(--accent-orange)' : 'var(--text-dim)', fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                  >
                    {m}
                  </button>
                ))}
              </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'LIMIT PRICE', suffix: '↗', suffixColor: 'var(--accent-orange)', val: limitPrice, set: setLimitPrice, ph: '77500' },
              { label: 'STOP-LOSS', suffix: '↘', suffixColor: 'var(--accent-red)', val: stopLoss, set: setStopLoss, ph: 'Optional' },
              { label: 'TAKE-PROFIT', suffix: '↗', suffixColor: 'var(--accent-green)', val: takeProfit, set: setTakeProfit, ph: 'Optional' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  {f.label} <span style={{ color: f.suffixColor }}>{f.suffix}</span>
                </label>
                <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-main)', border: '1px solid var(--border-bold)', color: f.val ? 'var(--text-primary)' : 'var(--text-dim)', fontSize: 14, fontWeight: 600, outline: 'none' }} />
              </div>
            ))}
          </div>

          {/* FUTURES SPECIFIC: Leverage & Side */}
          {tradeMode === 'FUTURES' && (
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em' }}>ISOLATED LEVERAGE: <span style={{ color: 'var(--accent-orange)' }}>{leverage}x</span></label>
                  <input type="range" min="1" max="50" value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ flex: 1, marginLeft: 20, accentColor: 'var(--accent-orange)' }} />
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <button onClick={() => setSide('LONG')} style={{ padding: '10px', borderRadius: 10, border: '1px solid', borderColor: side === 'LONG' ? 'var(--accent-green)' : 'var(--border-subtle)', background: side === 'LONG' ? 'rgba(0,230,118,0.1)' : 'transparent', color: side === 'LONG' ? 'var(--accent-green)' : 'var(--text-dim)', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>LONG</button>
                  <button onClick={() => setSide('SHORT')} style={{ padding: '10px', borderRadius: 10, border: '1px solid', borderColor: side === 'SHORT' ? 'var(--accent-red)' : 'var(--border-subtle)', background: side === 'SHORT' ? 'rgba(244,63,94,0.1)' : 'transparent', color: side === 'SHORT' ? 'var(--accent-red)' : 'var(--text-dim)', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>SHORT</button>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-dim)' }}>EST. LIQ PRICE:</span>
                  <span style={{ color: 'var(--accent-red)' }}>${(parseFloat(limitPrice) * (side === 'LONG' ? (1 - 0.8/leverage) : (1 + 0.8/leverage))).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
               </div>
            </div>
          )}

          {/* Info */}
          <div style={{ display: 'flex', gap: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
            <Info size={15} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#666', lineHeight: 1.55 }}>Orders are executed as Market Orders on the SoSo Smre Testnet. Stop-Loss and Take-Profit orders will be triggered automatically when the terminal price crosses the target.</p>
          </div>

          {/* Confirm Buy */}
          <button 
            onClick={confirmBuy} 
            disabled={tradeStatus !== 'IDLE'} 
            style={{ 
              width: '100%', 
              padding: 16, 
              borderRadius: 12, 
              background: tradeStatus === 'SUBMITTING' ? 'var(--bg-main)' : tradeStatus === 'SUCCESS' ? 'var(--accent-green)' : (tradeMode === 'FUTURES' ? (side === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--accent-orange)'), 
              color: tradeStatus === 'SUBMITTING' ? 'var(--text-primary)' : '#000', 
              border: tradeStatus === 'SUBMITTING' ? '1px solid var(--border-bold)' : 'none', 
              fontSize: 15, 
              fontWeight: 900, 
              letterSpacing: '.06em', 
              cursor: tradeStatus !== 'IDLE' ? 'not-allowed' : 'pointer', 
              opacity: portfolioLoaded ? 1 : 0.6, 
              boxShadow: tradeStatus !== 'IDLE' ? 'none' : `0 0 28px ${tradeMode === 'FUTURES' ? (side === 'LONG' ? 'rgba(0,230,118,0.3)' : 'rgba(244,63,94,0.3)') : 'rgba(249,115,22,0.3)'}`,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8, 
              transition: 'all 0.2s' 
            }}
          >
            {tradeStatus === 'SUBMITTING' ? <span className="spin" style={{ display: 'inline-block', fontSize: 18 }}>⟳</span> : null}
            {tradeStatus === 'SUCCESS' ? <CheckCircle size={18} color="#000" /> : null}
            {tradeStatus === 'SUCCESS' ? 'ORDER FILLED' : (tradeMode === 'SPOT' ? `CONFIRM BUY ${baseCoin}` : `OPEN ${side} ${baseCoin} ${leverage}x`)}
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
              if (aiActive) { 
                setAiActive(false); 
                setAiLogs(prev => [...prev.slice(-15), `[SYSTEM] Autonomous Agent halted by user.`]);
                return; 
              }
              setAiActive(true);
              setAiLogs(prev => [...prev.slice(-15), `[SYSTEM] Genius Mode Active. Monitoring market for ${baseCoin}...`]);
            }} style={{ width: '100%', padding: 16, borderRadius: 12, background: aiActive ? 'transparent' : 'var(--accent-blue)', color: aiActive ? 'var(--accent-red)' : '#fff', border: aiActive ? '1px solid var(--accent-red)' : 'none', fontSize: 14, fontWeight: 900, letterSpacing: '.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', boxShadow: aiActive ? 'none' : '0 0 20px rgba(59,130,246,0.4)' }}>
              {aiActive ? 'STOP GENIUS AGENT' : 'START GENIUS AUTO-TRADER'}
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
