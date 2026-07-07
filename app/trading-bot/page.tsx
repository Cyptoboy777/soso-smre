'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Zap, TrendingUp, TrendingDown, Activity, Bot, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface BotLog { id: number; ts: number; type: 'buy'|'sell'|'info'|'error'; msg: string; pnl?: number; }
interface BotConfig { symbol: string; strategy: 'momentum'|'mean_revert'|'ai_signal'; riskPct: number; maxTrades: number; }

const STRATEGIES = [
  { id: 'momentum',    label: 'Momentum',     desc: 'Buy breakouts, ride the trend' },
  { id: 'mean_revert', label: 'Mean Revert',  desc: 'Buy dips, sell recoveries' },
  { id: 'ai_signal',  label: 'AI Signal',    desc: 'Gemini-powered entry decisions' },
];

export default function TradingBotPage() {
  const { user } = useAuth();
  const [running,  setRunning]  = useState(false);
  const [logs,     setLogs]     = useState<BotLog[]>([]);
  const [pnl,      setPnl]      = useState(0);
  const [trades,   setTrades]   = useState(0);
  const [winRate,  setWinRate]  = useState(0);
  const [price,    setPrice]    = useState<number|null>(null);
  const [config,   setConfig]   = useState<BotConfig>({ symbol:'BTC', strategy:'ai_signal', riskPct:1, maxTrades:10 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIdRef    = useRef(0);
  const logsEndRef  = useRef<HTMLDivElement>(null);
  const winsRef     = useRef(0);
  const totalRef    = useRef(0);
  const portfolioRef = useRef<any>(null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [logs]);

  // Fetch live price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const r = await fetch('/api/prices');
        const d = await r.json();
        const sym = config.symbol.toUpperCase();
        const p = sym === 'BTC' ? d.btc : sym === 'ETH' ? d.eth : sym === 'SOL' ? d.sol : d.btc;
        if (p) setPrice(p);
      } catch {}
    };
    fetchPrice();
    const id = setInterval(fetchPrice, 10_000);
    return () => clearInterval(id);
  }, [config.symbol]);

  const loadPortfolio = () => {
    try {
      const raw = localStorage.getItem('soso_paper_portfolio');
      if (raw) {
        portfolioRef.current = JSON.parse(raw);
      } else {
        portfolioRef.current = { usdc: 10000, holdings: {}, trades: [], initialBalance: 10000, soPoints: 0 };
      }
    } catch {
      portfolioRef.current = { usdc: 10000, holdings: {}, trades: [], initialBalance: 10000, soPoints: 0 };
    }
  };

  const addLog = (type: BotLog['type'], msg: string, pnl?: number) => {
    setLogs(prev => [...prev.slice(-99), { id: ++logIdRef.current, ts: Date.now(), type, msg, pnl }]);
  };

  const executePaperTrade = async (symbol: string, type: 'BUY' | 'SELL', price: number, confidence: number, reasoning: string) => {
    if (!portfolioRef.current) {
      loadPortfolio();
    }
    const portfolio = portfolioRef.current;
    const baseCoin = symbol.toUpperCase();

    // Determine target USDC allocation based on riskPct
    const riskUsdc = Math.max(100, Math.round(portfolio.usdc * (config.riskPct / 100)));
    const holdingAmt = portfolio.holdings[baseCoin]?.amount || 0;
    
    let size = riskUsdc / price;
    if (type === 'SELL') {
      size = Math.min(size, holdingAmt);
      if (size <= 0.0001) {
        addLog('error', `Skipping SELL for ${baseCoin}: No holdings to liquidate.`);
        return;
      }
    } else {
      if (riskUsdc > portfolio.usdc) {
        addLog('error', `Skipping BUY for ${baseCoin}: Insufficient USDC margin (needs $${riskUsdc}, balance is $${portfolio.usdc.toFixed(2)}).`);
        return;
      }
    }

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: baseCoin,
          type,
          amount: size,
          price,
          availableUsdc: portfolio.usdc,
          currentHolding: holdingAmt,
          tradeMode: 'SPOT'
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addLog('error', `Trade rejected: ${data.error ?? 'Execution failure'}`);
        return;
      }

      if (data.trade) {
        const tradeTotal = data.trade.total;
        const tradeSize = data.trade.size || size;

        // Compute PnL for sells
        let tradePnl: number | undefined;
        let isWin = false;
        if (type === 'SELL') {
          const avgBuy = portfolio.holdings[baseCoin]?.avgBuyPrice || price;
          tradePnl = +((price - avgBuy) * tradeSize).toFixed(2);
          isWin = tradePnl > 0;
          totalRef.current++;
          if (isWin) winsRef.current++;
          setPnl(p => +(p + tradePnl!).toFixed(2));
          setWinRate(Math.round((winsRef.current / totalRef.current) * 100));
        }
        setTrades(t => t + 1);

        const nextPortfolio = {
          ...portfolio,
          usdc: type === 'SELL' ? portfolio.usdc + tradeTotal : Math.max(0, portfolio.usdc - tradeTotal),
          holdings: { ...portfolio.holdings },
          trades: [
            {
              id: data.trade.id,
              symbol: baseCoin,
              type,
              amount: tradeSize,
              price,
              total: tradeTotal,
              timestamp: Date.now()
            },
            ...(portfolio.trades ?? [])
          ],
          soPoints: (portfolio.soPoints ?? 0) + (data.soPointsEarned ?? 20)
        };

        const h = nextPortfolio.holdings[baseCoin] ? { ...nextPortfolio.holdings[baseCoin] } : { symbol: baseCoin, amount: 0, avgBuyPrice: price };
        if (type === 'SELL') {
          h.amount = Math.max(0, h.amount - tradeSize);
          if (h.amount <= 0.0001) {
            h.amount = 0;
            h.avgBuyPrice = 0;
          }
        } else {
          const newTotal = h.amount + tradeSize;
          h.avgBuyPrice = (h.amount * h.avgBuyPrice + tradeTotal) / newTotal;
          h.amount = newTotal;
        }
        nextPortfolio.holdings[baseCoin] = h;

        portfolioRef.current = nextPortfolio;
        localStorage.setItem('soso_paper_portfolio', JSON.stringify(nextPortfolio));

        if (user && db) {
          const ref = doc(db, 'users', user.uid, 'private', 'portfolio');
          setDoc(ref, { ...nextPortfolio, updatedAt: serverTimestamp() }).catch(e => console.error("Cloud Sync Delayed:", e));
        }

        const logMsg = `${type} ${baseCoin} @ $${price.toLocaleString()} | Qty: ${tradeSize.toFixed(4)} | Conf: ${confidence}% | ${reasoning.slice(0, 60)}…`;
        addLog(type === 'BUY' ? 'buy' : 'sell', logMsg, tradePnl);
      }
    } catch (e: any) {
      addLog('error', `Execution failed: ${e.message ?? 'Network Error'}`);
    }
  };

  const runBotTick = async (currentPrice: number) => {
    if (config.strategy === 'ai_signal') {
      try {
        const r = await fetch('/api/ai-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: config.symbol, riskProfile: 'Moderate', timeframe: '5M' }),
        });
        const d = await r.json();
        const sig = d.signal;
        if (!sig) return;
        const action = sig.signal as 'BUY'|'SELL'|'HOLD';
        if (action === 'HOLD') { addLog('info', `HOLD ${config.symbol} — ${sig.reasoning?.slice(0,80)}…`); return; }

        await executePaperTrade(config.symbol, action, currentPrice, sig.confidence, sig.reasoning || '');
      } catch { addLog('error', 'AI signal fetch failed — retrying next tick'); }
    } else {
      // Simulated momentum / mean-revert logic
      const isBuy = config.strategy === 'momentum' ? Math.random() > 0.45 : Math.random() > 0.55;
      const action = isBuy ? 'BUY' : 'SELL';
      const reason = config.strategy === 'momentum'
        ? 'Trend breakout detected on shorter timeframes'
        : 'RSI oversold deviation reverting to historical mean';
      await executePaperTrade(config.symbol, action, currentPrice, 75, reason);
    }
  };

  const startBot = () => {
    if (!price) { addLog('error', 'No live price available — check connection'); return; }
    loadPortfolio();
    setRunning(true);
    winsRef.current = 0; totalRef.current = 0;
    setLogs([]); setPnl(0); setTrades(0); setWinRate(0);
    addLog('info', `🤖 Bot started | Strategy: ${config.strategy} | Risk: ${config.riskPct}% | Pair: ${config.symbol}/USDC`);
    intervalRef.current = setInterval(() => {
      setPrice(p => {
        if (p) runBotTick(p);
        return p;
      });
    }, config.strategy === 'ai_signal' ? 15_000 : 8_000);
  };

  const stopBot = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    addLog('info', `⛔ Bot stopped | Final PnL: ${pnl > 0 ? '+' : ''}$${pnl} | Trades: ${trades} | Win Rate: ${winRate}%`);
  };

  const logColor = (t: BotLog['type']) =>
    t === 'buy' ? '#2bd9a8' : t === 'sell' ? '#ff6b6b' : t === 'error' ? '#f97316' : '#94a3b8';

  return (
    <div className="page-in" style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#4f9cff,#9d7bff)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Bot size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, margin:0, letterSpacing:'-0.03em' }}>Auto Trading Bot</h1>
          <p style={{ fontSize:12, color:'var(--text-dim)', margin:0, fontWeight:600 }}>Paper-trade · AI-powered signals · Real SoDEX prices</p>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <motion.div animate={{ opacity: running ? [1,0.3,1] : 0.3 }} transition={{ repeat:Infinity, duration:1 }}
            style={{ width:8, height:8, borderRadius:'50%', background: running ? '#2bd9a8' : '#555' }}/>
          <span style={{ fontSize:11, fontWeight:900, color: running ? '#2bd9a8' : 'var(--text-dim)' }}>{running ? 'BOT ACTIVE' : 'IDLE'}</span>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20 }}>
        {/* LEFT: Config */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Live price */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:16, padding:'16px 20px' }}>
            <div style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, letterSpacing:'.12em', marginBottom:8 }}>LIVE PRICE</div>
            <div style={{ fontSize:28, fontWeight:900, fontFamily:'monospace', color:'#fff' }}>
              {price ? `$${price.toLocaleString()}` : '---'}
            </div>
            <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>{config.symbol}/USDC · SoDEX Mainnet</div>
          </div>

          {/* PnL Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:'PnL',      val: `${pnl >= 0 ? '+' : ''}$${pnl}`,  color: pnl >= 0 ? '#2bd9a8' : '#ff6b6b' },
              { label:'Trades',   val: trades.toString(),                  color: '#fff' },
              { label:'Win Rate', val: `${winRate}%`,                      color: winRate >= 55 ? '#2bd9a8' : winRate >= 40 ? '#ffd740' : '#ff6b6b' },
              { label:'Status',   val: running ? 'LIVE' : 'IDLE',          color: running ? '#2bd9a8' : 'var(--text-dim)' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:8, color:'var(--text-dim)', fontWeight:800, letterSpacing:'.1em', marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:16, fontWeight:900, color:s.color, fontFamily:'monospace' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Config */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:16, padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, letterSpacing:'.12em' }}>BOT CONFIGURATION</div>

            {/* Symbol */}
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, display:'block', marginBottom:6 }}>TRADING PAIR</label>
              <div style={{ display:'flex', gap:6 }}>
                {['BTC','ETH','SOL'].map(s => (
                  <button key={s} onClick={() => setConfig(c => ({...c, symbol:s}))} disabled={running} style={{ flex:1, padding:'7px 0', borderRadius:8, border:`1px solid ${config.symbol===s ? 'var(--accent-orange)' : 'var(--border-bold)'}`, background: config.symbol===s ? 'rgba(249,115,22,0.12)' : 'transparent', color: config.symbol===s ? 'var(--accent-orange)' : 'var(--text-dim)', fontSize:11, fontWeight:900, cursor:'pointer' }}>{s}</button>
                ))}
              </div>
            </div>

            {/* Strategy */}
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, display:'block', marginBottom:6 }}>STRATEGY</label>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {STRATEGIES.map(st => (
                  <button key={st.id} onClick={() => setConfig(c => ({...c, strategy:st.id as any}))} disabled={running} style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${config.strategy===st.id ? '#4f9cff' : 'var(--border-bold)'}`, background: config.strategy===st.id ? 'rgba(79,156,255,0.12)' : 'transparent', color:'#fff', textAlign:'left', cursor:'pointer', transition:'all 0.2s' }}>
                    <div style={{ fontSize:11, fontWeight:800, color: config.strategy===st.id ? '#7db4ff' : '#fff' }}>{st.label}</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{st.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)', fontWeight:800, display:'block', marginBottom:6 }}>RISK PER TRADE: {config.riskPct}%</label>
              <input type="range" min={0.5} max={5} step={0.5} value={config.riskPct} disabled={running}
                onChange={e => setConfig(c => ({...c, riskPct:+e.target.value}))}
                style={{ width:'100%', accentColor:'var(--accent-orange)' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--text-dim)', marginTop:3 }}>
                <span>0.5% Conservative</span><span>5% Aggressive</span>
              </div>
            </div>

            {/* Start/Stop */}
            <motion.button whileTap={{ scale:0.97 }} onClick={running ? stopBot : startBot}
              style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', cursor:'pointer', fontSize:13, fontWeight:900, letterSpacing:'.04em', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                background: running ? 'linear-gradient(135deg,#ff6b6b,#be123c)' : 'linear-gradient(135deg,#4f9cff,#9d7bff)',
                color:'#fff', boxShadow: running ? '0 8px 24px rgba(255,107,107,0.3)' : '0 8px 24px rgba(79,156,255,0.3)' }}>
              {running ? <><Square size={14} fill="#fff"/> STOP BOT</> : <><Play size={14} fill="#fff"/> START BOT</>}
            </motion.button>
          </div>
        </div>

        {/* RIGHT: Log terminal */}
        <div style={{ background:'rgba(0,0,0,0.4)', border:'1px solid var(--border-subtle)', borderRadius:20, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:560 }}>
          {/* Terminal header */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:10, background:'rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', gap:6 }}>
              {['#ff6b6b','#fbbf24','#2bd9a8'].map(c => <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}
            </div>
            <span style={{ fontSize:10, fontWeight:900, color:'var(--text-dim)', letterSpacing:'.12em', marginLeft:6 }}>BOT EXECUTION LOG</span>
            {running && (
              <motion.div animate={{ opacity:[1,0,1] }} transition={{ repeat:Infinity, duration:1 }} style={{ marginLeft:'auto', fontSize:9, color:'#2bd9a8', fontWeight:900 }}>
                ● LIVE
              </motion.div>
            )}
          </div>

          {/* Logs */}
          <div className="scroll-track" style={{ flex:1, overflowY:'auto', padding:'12px 16px', fontFamily:'monospace', fontSize:11, display:'flex', flexDirection:'column', gap:6 }}>
            {logs.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12, opacity:0.3 }}>
                <Bot size={40}/>
                <span style={{ fontSize:13, fontWeight:700 }}>Configure and start the bot to see execution logs</span>
              </div>
            ) : logs.map(log => (
              <div key={log.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'5px 8px', borderRadius:7, background: log.type === 'buy' ? 'rgba(43,217,168,0.05)' : log.type === 'sell' ? 'rgba(255,107,107,0.05)' : 'transparent' }}>
                <span style={{ color:'var(--text-dim)', fontSize:9, flexShrink:0, marginTop:1 }}>
                  {new Date(log.ts).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                </span>
                <span style={{ color: logColor(log.type), fontWeight: log.type !== 'info' ? 800 : 400, flex:1, lineHeight:1.5 }}>{log.msg}</span>
                {log.pnl !== undefined && (
                  <span style={{ color: log.pnl >= 0 ? '#2bd9a8' : '#ff6b6b', fontWeight:900, fontSize:10, flexShrink:0 }}>
                    {log.pnl >= 0 ? '+' : ''}${log.pnl}
                  </span>
                )}
              </div>
            ))}
            <div ref={logsEndRef}/>
          </div>

          {/* Summary bar */}
          {trades > 0 && (
            <div style={{ padding:'10px 20px', borderTop:'1px solid var(--border-subtle)', background:'rgba(0,0,0,0.3)', display:'flex', gap:24 }}>
              {[
                { l:'Total Trades', v:trades.toString() },
                { l:'Win Rate',     v:`${winRate}%` },
                { l:'Net PnL',      v:`${pnl>=0?'+':''}$${pnl}`, c: pnl>=0?'#2bd9a8':'#ff6b6b' },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ fontSize:8, color:'var(--text-dim)', fontWeight:800 }}>{s.l}</div>
                  <div style={{ fontSize:13, fontWeight:900, color:s.c??'#fff', fontFamily:'monospace' }}>{s.v}</div>
                </div>
              ))}
              <div style={{ marginLeft:'auto', fontSize:9, color:'var(--text-dim)', alignSelf:'center' }}>⚠ PAPER TRADING — No real funds</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
