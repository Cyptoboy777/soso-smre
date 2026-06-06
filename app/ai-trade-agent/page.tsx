'use client';
import { useState, useEffect, useCallback } from 'react';
import { Info, CheckCircle } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';
import { CopyTradePanel } from '@/components/SodexMarket';
import { useSodexStore } from '@/store/sodexStore';
import { Search } from 'lucide-react';

interface Holding { symbol: string; amount: number; avgBuyPrice: number; }
interface Trade { id: string; symbol: string; type: 'BUY'|'SELL'; amount: number; price: number; total: number; timestamp: number; }
interface Portfolio { usdc: number; holdings: Record<string,Holding>; trades: Trade[]; initialBalance: number; soPoints: number; }
interface HoldingAnalytic extends Holding { currentPrice: number; currentValue: number; pnl: number; pnlPct: number; }
interface Analytics { totalValue: number; holdingsValue: number; totalPnl: number; totalPnlPct: number; holdings: HoldingAnalytic[]; }

const DEFAULT_PORTFOLIO: Portfolio = { usdc: 10000, holdings: {}, trades: [], initialBalance: 10000, soPoints: 0 };

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
  const [assets, setAssets] = useState<string[]>(['BTC / USDC', 'ETH / USDC', 'SOL / USDC', 'BNB / USDC', 'SOSO / USDC']);
  const [chartHeight] = useState(420);
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
  const [spotSide, setSpotSide] = useState<'BUY' | 'SELL'>('BUY');
  const [aiActive, setAiActive] = useState(false);
  
  // Custom Token Search State
  const [searchToken, setSearchToken] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const tickerList = useSodexStore(state => state.tickerList);
  
  const [aiLogs, setAiLogs] = useState<string[]>(['SOSO AI-Trader initialized. Engine ready.']);
  const [strategy, setStrategy] = useState('Momentum + Sentiment');
  const [risk, setRisk] = useState('Medium');
  
  // Freqtrade Advanced State
  const [advancedMode, setAdvancedMode] = useState(false);
  const [exchange, setExchange] = useState('SoDEX');
  const [maxTrades, setMaxTrades] = useState('3');
  const [trailingStop, setTrailingStop] = useState(true);

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
      // 1. Restore Manual Trade Setup from LocalStorage (Persistence)
      const savedSetup = localStorage.getItem('soso_trade_setup');
      if (savedSetup) {
        try {
          const { asset: sA, amount: sAm, stopLoss: sSL, takeProfit: sTP } = JSON.parse(savedSetup);
          if (sA) setAsset(sA);
          if (sAm) setAmount(sAm);
          if (sSL) setStopLoss(sSL);
          if (sTP) setTakeProfit(sTP);
        } catch {}
      }

      // 2. Fetch Assets first so we can map URL params correctly
      try {
        const ar = await fetch('/api/prices');
        const ad = await ar.json();
        if (ad.prices && ad.prices.length > 0) {
          const symbols = ad.prices.map((p: any) => {
            const base = p.symbol.includes('_') ? p.symbol.split('_')[0] : p.symbol.replace('USDT', '');
            const quote = p.symbol.includes('_') ? 'vUSDC' : 'USDC';
            return `${base} / ${quote}`;
          });
          const unique = Array.from(new Set(symbols)) as string[];
          setAssets(unique);

          // Handle URL params after assets are loaded (URL takes priority over saved setup)
          const params = new URLSearchParams(window.location.search);
          const pAsset = params.get('asset');
          const pStopLoss = params.get('stopLoss');
          const pTarget = params.get('target');

          if (pAsset) {
            const match = unique.find(a => a.startsWith(pAsset.toUpperCase()));
            if (match) setAsset(match);
          }
          if (pStopLoss) setStopLoss(pStopLoss);
          if (pTarget) setTakeProfit(pTarget);
        }
      } catch {}

      // 3. Instant Local Storage Fallback (Zero Latency Paper Trading)
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

      // 4. Cloud Sync (Permanent Storage)
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
        const d = await r.json() as { prices: Array<{ symbol: string; price: string }>; source?: string };
        
        // Find by base coin — handle both 'BTCUSDT' (CG) and 'vBTC_vUSDC' (SoDEX)
        const isSodex = d.source === 'sodex';
        const searchKey = isSodex ? `v${baseCoin}_vUSDC` : `${baseCoin}USDT`;
        
        const found = d.prices?.find(p => p.symbol === searchKey);
        if (found) {
          const p = parseFloat(found.price);
          setLimitPrice(p.toString());
          setLivePrice(p);
          
          const tp = p * 1.03;
          const sl = p * 0.98;
          const decimals = p < 1 ? 4 : (p < 100 ? 2 : 1);
          
          setTakeProfit(tp.toFixed(decimals));
          setStopLoss(sl.toFixed(decimals));
        }
      } catch {}
    };
    fetchPrice();
    const id = setInterval(fetchPrice, 10000);
    return () => clearInterval(id);
  }, [baseCoin]);


  // Auto-update price/SL/TP on asset change
  useEffect(() => {
    if (!asset) return;
    const base = asset.split(' / ')[0];
    fetch('/api/prices')
      .then(r => r.json())
      .then(d => {
        if (d.prices) {
          const sym = asset.includes('vUSDC') ? `v${base}_vUSDC` : `${base}USDT`;
          const found = d.prices.find((p: any) => p.symbol === sym);
          if (found) {
            const p = parseFloat(found.price);
            setLimitPrice(p.toString());
            // Only auto-calc if not coming from URL params (which we'd check via a ref or just let the first load be handled)
            const params = new URLSearchParams(window.location.search);
            if (!params.get('stopLoss')) {
              setStopLoss((p * 0.98).toFixed(found.price.includes('.') ? found.price.split('.')[1].length : 2));
              setTakeProfit((p * 1.03).toFixed(found.price.includes('.') ? found.price.split('.')[1].length : 2));
            }
          }
        }
      });
  }, [asset]);

  // Persist Manual Trade Setup to LocalStorage
  useEffect(() => {
    const setup = { asset, amount, stopLoss, takeProfit };
    localStorage.setItem('soso_trade_setup', JSON.stringify(setup));
  }, [asset, amount, stopLoss, takeProfit]);

  const setPct = (pct: number) => {
    if (tradeMode === 'SPOT' && spotSide === 'SELL') {
      const holdingAmt = portfolio.holdings[baseCoin]?.amount || 0;
      const currentPrice = parseFloat(limitPrice) || livePrice || 1;
      const val = holdingAmt * currentPrice;
      setAmount((val * pct / 100).toFixed(2));
    } else {
      const maxUsdc = portfolio.usdc * pct / 100;
      setAmount(maxUsdc.toFixed(2));
    }
  };

  const confirmBuy = useCallback(async (overrideAmount?: string | React.MouseEvent) => {
    const amtStr = typeof overrideAmount === 'string' ? overrideAmount : amount;
    const tradeAmount = parseFloat(amtStr);
    const price = parseFloat(limitPrice) || livePrice || 78000;
    
    if (!tradeAmount || tradeAmount <= 0) { setToast('Enter a valid amount'); return; }
    
    // Logic for amount tokens and validation
    const currentHolding = portfolio.holdings[baseCoin]?.amount || 0;
    const isSell = tradeMode === 'SPOT' && spotSide === 'SELL';
    let amountTokens = (tradeAmount * (tradeMode === 'FUTURES' ? leverage : 1)) / price;
    const marginRequired = tradeMode === 'FUTURES' ? tradeAmount / leverage : tradeAmount;

    // Prevent floating point rounding errors from breaking "MAX" sell
    if (isSell && Math.abs(amountTokens - currentHolding) < (currentHolding * 0.01)) {
        amountTokens = currentHolding; 
    }

    if (isSell) {
      if (amountTokens > currentHolding) { setToast(`Insufficient ${baseCoin}. Available: ${currentHolding.toFixed(4)}`); return; }
    } else {
      if (marginRequired > portfolio.usdc) { setToast(`Insufficient USDC. Required Margin: $${marginRequired.toFixed(2)}`); return; }
    }

    setTradeStatus('SUBMITTING');
    console.log("[TRADE] Initiating...", { baseCoin, tradeAmount, tradeMode, side, spotSide, leverage });

    try {
      const type = tradeMode === 'SPOT' ? spotSide : side;
      const r = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol: baseCoin, 
          type, 
          amount: amountTokens, 
          price, 
          availableUsdc: portfolio.usdc,
          currentHolding,
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
            usdc: isSell ? prev.usdc + d.trade!.total : Math.max(0, prev.usdc - marginRequired),
            holdings: { ...prev.holdings },
            trades: [d.trade!, ...(prev.trades ?? [])],
            soPoints: (prev.soPoints ?? 0) + (d.soPointsEarned ?? 0)
          };

          if (tradeMode === 'SPOT') {
            const h = next.holdings[baseCoin] ? { ...next.holdings[baseCoin] } : { symbol: baseCoin, amount: 0, avgBuyPrice: price };
            
            if (isSell) {
              h.amount = h.amount - d.trade!.amount;
              if (h.amount <= 0.000001) { h.amount = 0; h.avgBuyPrice = 0; }
            } else {
              const newTotal = h.amount + d.trade!.amount;
              h.avgBuyPrice = (h.amount * h.avgBuyPrice + d.trade!.total) / newTotal;
              h.amount = newTotal;
            }
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

        const tradeMsg = tradeMode === 'SPOT' ? `${spotSide} ${baseCoin}` : `${side} ${baseCoin} ${leverage}x`;
        setToast(`Order filled: ${tradeMsg} for $${tradeAmount.toLocaleString()}`);
        setAmount('0.00');
        setTimeout(() => setTradeStatus('IDLE'), 2000);
      }
    } catch (err) { 
      console.error("[TRADE] Execution Error:", err);
      setToast('Network Error: Unable to reach trade engine.'); 
      setTradeStatus('IDLE'); 
    }
  }, [amount, limitPrice, livePrice, portfolio, baseCoin, user, fetchAnalytics, tradeMode, leverage, side, spotSide]);

  const displayHoldings = analytics?.holdings ?? Object.values(portfolio.holdings ?? {}).map(h => ({ ...h, currentPrice: h.avgBuyPrice, currentValue: h.amount * h.avgBuyPrice, pnl: 0, pnlPct: 0 }));
  const totalValue = analytics?.totalValue ?? (portfolio.usdc + displayHoldings.reduce((s, h) => s + h.amount * h.avgBuyPrice, 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px 300px', height: '100%', overflow: 'hidden', gap: 0 }}>

      {/* LEFT COL: Search + Execution */}
      <div style={{ overflowY: 'auto', padding: '16px 12px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* TOKEN SEARCH (Paper Trading) */}
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: 16, position: 'relative' }}>
              <h3 style={{ fontSize: 10, fontWeight: 900, color: '#444', margin: 0, marginBottom: 10, letterSpacing: '.1em' }}>SELECT TOKEN (PAPER TRADE)</h3>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#666" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search SOL, BTC, PEPE..."
                  value={searchToken}
                  onChange={(e) => {
                    setSearchToken(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  style={{ width: '100%', padding: '12px 12px 12px 34px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                {showSearchDropdown && searchToken && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
                    {tickerList
                      .filter(t => t.base.toLowerCase().includes(searchToken.toLowerCase()))
                      .map(t => (
                        <div
                          key={t.symbol}
                          onClick={() => {
                            setAsset(`${t.base} / USDC`);
                            setSearchToken('');
                            setShowSearchDropdown(false);
                          }}
                          style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}
                        >
                          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{t.base}</span>
                          <span style={{ color: '#888', fontSize: 11 }}>${t.lastPrice.toFixed(4)}</span>
                        </div>
                      ))}
                    {tickerList.filter(t => t.base.toLowerCase().includes(searchToken.toLowerCase())).length === 0 && (
                      <div style={{ padding: '10px 12px', color: '#666', fontSize: 12 }}>No tokens found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* EXECUTION PANEL */}
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 10, fontWeight: 900, color: '#444', margin: 0, letterSpacing: '.1em' }}>PLACE ORDER</h3>
                <div style={{ display: 'flex', background: '#111', padding: 3, borderRadius: 8 }}>
                  {['BUY', 'SELL'].map(s => (
                    <button key={s} onClick={() => setSpotSide(s as any)} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: spotSide === s ? (s === 'BUY' ? '#00e676' : '#f43f5e') : 'transparent', color: spotSide === s ? '#000' : '#555', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 9, color: '#444', fontWeight: 800 }}>AMOUNT (USDC)</label>
                    <span style={{ fontSize: 9, color: '#fff', fontWeight: 800 }}>Price: ${parseFloat(limitPrice).toLocaleString()}</span>
                  </div>
                  <input value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {[25, 50, 75, 100].map(p => (
                      <button key={p} onClick={() => setPct(p)} style={{ flex: 1, padding: '5px 0', borderRadius: 5, background: '#1a1a1a', border: '1px solid #252525', color: '#666', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{p}%</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 9, color: '#f43f5e', fontWeight: 800, display: 'block', marginBottom: 4 }}>STOP LOSS</label>
                    <input value={stopLoss} onChange={e => setStopLoss(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 7, background: '#111', border: '1px solid #2a1a1a', color: '#f43f5e', fontSize: 12, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: '#00e676', fontWeight: 800, display: 'block', marginBottom: 4 }}>TAKE PROFIT</label>
                    <input value={takeProfit} onChange={e => setTakeProfit(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 7, background: '#111', border: '1px solid #1a2a1a', color: '#00e676', fontSize: 12, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button onClick={confirmBuy} disabled={tradeStatus !== 'IDLE'} style={{ width: '100%', padding: '14px', borderRadius: 10, background: spotSide === 'BUY' ? 'linear-gradient(135deg,#00e676,#00c853)' : 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#000', border: 'none', fontSize: 13, fontWeight: 900, cursor: 'pointer', boxShadow: spotSide === 'BUY' ? '0 6px 20px rgba(0,230,118,0.25)' : '0 6px 20px rgba(244,63,94,0.25)' }}>
                  {tradeStatus === 'SUBMITTING' ? 'EXECUTING...' : `CONFIRM ${spotSide}`}
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* MIDDLE COL: AI Agent */}
      <div style={{ background: 'linear-gradient(180deg,#0a101d,#050505)', borderLeft: '1px solid #1e293b', borderRight: '1px solid #1e293b', overflowY: 'auto', padding: 16 }}>
        <div style={{ background: 'transparent' }}>
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

            {/* Advanced Freqtrade Mode */}
            <div style={{ marginBottom: 20 }}>
               <button onClick={() => setAdvancedMode(!advancedMode)} style={{ width: '100%', background: 'transparent', border: '1px dashed #1e293b', borderRadius: 8, padding: '8px', color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                 {advancedMode ? 'HIDE ADVANCED SETTINGS (FREQTRADE)' : 'SHOW ADVANCED SETTINGS (FREQTRADE)'}
               </button>

               {advancedMode && (
                 <div style={{ marginTop: 12, padding: 14, background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                       <div>
                          <label style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 6 }}>TARGET EXCHANGE</label>
                          <select value={exchange} onChange={e => setExchange(e.target.value)} disabled={aiActive} style={{ width: '100%', padding: '8px', borderRadius: 6, background: '#020617', border: '1px solid #1e293b', color: '#38bdf8', fontSize: 12, outline: 'none' }}>
                            <option>SoDEX</option>
                            <option>Binance</option>
                            <option>Bybit</option>
                            <option>OKX</option>
                          </select>
                       </div>
                       <div>
                          <label style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 6 }}>MAX OPEN TRADES</label>
                          <input type="number" value={maxTrades} onChange={e => setMaxTrades(e.target.value)} disabled={aiActive} style={{ width: '100%', padding: '8px', borderRadius: 6, background: '#020617', border: '1px solid #1e293b', color: '#38bdf8', fontSize: 12, outline: 'none' }} />
                       </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#020617', padding: '8px 12px', borderRadius: 6, border: '1px solid #1e293b' }}>
                       <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>DYNAMIC TRAILING STOP-LOSS</span>
                       <button onClick={() => !aiActive && setTrailingStop(!trailingStop)} style={{ width: 36, height: 20, borderRadius: 10, background: trailingStop ? '#00e676' : '#333', border: 'none', position: 'relative', cursor: aiActive ? 'not-allowed' : 'pointer', transition: '0.2s' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: trailingStop ? 18 : 2, transition: '0.2s' }} />
                       </button>
                    </div>
                 </div>
               )}
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
                setAiLogs(prev => [...prev.slice(-15), `[FREQTRADE] Initializing... Target: ${exchange} | Max Trades: ${maxTrades} | Trailing Stop: ${trailingStop ? 'ON' : 'OFF'}`]);
                setTimeout(() => {
                  setAiLogs(prev => [...prev.slice(-15), `[SYSTEM] Genius Mode Active. Monitoring market for ${baseCoin}...`]);
                }, 1000);
              }} style={{ width: '100%', padding: 16, borderRadius: 12, background: aiActive ? 'transparent' : 'var(--accent-blue)', color: aiActive ? 'var(--accent-red)' : '#fff', border: aiActive ? '1px solid var(--accent-red)' : 'none', fontSize: 14, fontWeight: 900, letterSpacing: '.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', boxShadow: aiActive ? 'none' : '0 0 20px rgba(59,130,246,0.4)' }}>
                {aiActive ? 'STOP GENIUS AGENT' : 'START FREQTRADE AI AGENT'}
              </button>
          </div>
        </div>

      {/* RIGHT COL: Portfolio + News */}
      <div style={{ background: '#0d0d0d', borderLeft: '1px solid #1e1e1e', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Portfolio content inside RIGHT COL */}
        <div style={{ flex: 1 }}>
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
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  );
}
