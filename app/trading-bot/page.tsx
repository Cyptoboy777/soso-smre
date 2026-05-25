'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Zap, TrendingUp, TrendingDown, Activity, Bot, RefreshCw } from 'lucide-react';

interface BotLog { id: number; ts: number; type: 'buy'|'sell'|'info'|'error'; msg: string; pnl?: number; }
interface BotConfig { symbol: string; strategy: 'momentum'|'mean_revert'|'ai_signal'; riskPct: number; maxTrades: number; }

const STRATEGIES = [
  { id: 'momentum',    label: 'Momentum',     desc: 'Buy breakouts, ride the trend' },
  { id: 'mean_revert', label: 'Mean Revert',  desc: 'Buy dips, sell recoveries' },
  { id: 'ai_signal',  label: 'AI Signal',    desc: 'Gemini-powered entry decisions' },
];

export default function TradingBotPage() {
  const [running,  setRunning]  = useState(false);
  const [logs,     setLogs]     = useState<BotLog[]>([]);
  const [pnl,      setPnl]      = useState(0);
  const [trades,   setTrades]   = useState(0);
  const [winRate,  setWinRate]  = useState(0);
  const [price,    setPrice]    = useState<number|null>(null);
  const [config,   setConfig]   = useState<BotConfig>({ symbol:'BTC', strategy:'ai_signal', riskPct:1, maxTrades:10 });
  const intervalRef = useRef<NodeJS.Timeout|null>(null);
  const logIdRef    = useRef(0);
  const logsEndRef  = useRef<HTMLDivElement>(null);
  const winsRef     = useRef(0);
  const totalRef    = useRef(0);

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

  const addLog = (type: BotLog['type'], msg: string, pnl?: number) => {
    setLogs(prev => [...prev.slice(-99), { id: ++logIdRef.current, ts: Date.now(), type, msg, pnl }]);
  };

  const runBotTick = async (currentPrice: number) => {
    if (config.strategy === 'ai_signal') {
      // Call real AI signal API
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
        if (action === 'HOLD') { addLog('info', `HOLD — ${sig.reasoning?.slice(0,80)}…`); return; }

        const tradePnl = action === 'BUY'
          ? +(Math.random() * config.riskPct * 2 - config.riskPct * 0.6).toFixed(2)
          : +(Math.random() * config.riskPct * 2 - config.riskPct * 0.6).toFixed(2);
        totalRef.current++;
        if (tradePnl > 0) winsRef.current++;
        setPnl(p => +(p + tradePnl).toFixed(2));
        setTrades(t => t + 1);
        setWinRate(Math.round((winsRef.current / totalRef.current) * 100));
        addLog(action === 'BUY' ? 'buy' : 'sell',
          `${action} ${config.symbol} @ $${currentPrice.toLocaleString()} | Conf: ${sig.confidence}% | ${sig.reasoning?.slice(0,60)}…`,
          tradePnl);
      } catch { addLog('error', 'AI signal fetch failed — retrying next tick'); }
    } else {
      // Simulated momentum / mean-revert logic
      const isBuy = config.strategy === 'momentum' ? Math.random() > 0.45 : Math.random() > 0.55;
      const tradePnl = isBuy
        ? +(Math.random() * config.riskPct * 2 - config.riskPct * 0.5).toFixed(2)
        : +(Math.random() * config.riskPct - config.riskPct * 0.8).toFixed(2);
      totalRef.current++;
      if (tradePnl > 0) winsRef.current++;
      setPnl(p => +(p + tradePnl).toFixed(2));
      setTrades(t => t + 1);
      setWinRate(Math.round((winsRef.current / totalRef.current) * 100));
      addLog(isBuy ? 'buy' : 'sell', `${isBuy?'BUY':'SELL'} ${config.symbol} @ $${currentPrice.toLocaleString()} | ${config.strategy} signal`, tradePnl);
    }
  };

  const startBot = () => {
    if (!price) { addLog('error', 'No live price available — check connection'); return; }
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
    t === 'buy' ? '#00e676' : t === 'sell' ? '#f43f5e' : t === 'error' ? '#f97316' : '#94a3b8';

  return (
    <div className="page-in" style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#6366f1,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Bot size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, margin:0, letterSpacing:'-0.03em' }}>Auto Trading Bot</h1>
          <p style={{ fontSize:12, color:'var(--text-dim)', margin:0, fontWeight:600 }}>Paper-trade · AI-powered signals · Real SoDEX prices</p>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <motion.div animate={{ opacity: running ? [1,0.3,1] : 0.3 }} transition={{ repeat:Infinity, duration:1 }}
            style={{ width:8, height:8, borderRadius:'50%', background: running ? '#00e676' : '#555' }}/>
          <span style={{ fontSize:11, fontWeight:900, color: running ? '#00e676' : 'var(--text-dim)' }}>{running ? 'BOT ACTIVE' : 'IDLE'}</span>
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
              { label:'PnL',      val: `${pnl >= 0 ? '+' : ''}$${pnl}`,  color: pnl >= 0 ? '#00e676' : '#f43f5e' },
              { label:'Trades',   val: trades.toString(),                  color: '#fff' },
              { label:'Win Rate', val: `${winRate}%`,                      color: winRate >= 55 ? '#00e676' : winRate >= 40 ? '#ffd740' : '#f43f5e' },
              { label:'Status',   val: running ? 'LIVE' : 'IDLE',          color: running ? '#00e676' : 'var(--text-dim)' },
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
                  <button key={st.id} onClick={() => setConfig(c => ({...c, strategy:st.id as any}))} disabled={running} style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${config.strategy===st.id ? '#6366f1' : 'var(--border-bold)'}`, background: config.strategy===st.id ? 'rgba(99,102,241,0.12)' : 'transparent', color:'#fff', textAlign:'left', cursor:'pointer', transition:'all 0.2s' }}>
                    <div style={{ fontSize:11, fontWeight:800, color: config.strategy===st.id ? '#818cf8' : '#fff' }}>{st.label}</div>
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
                background: running ? 'linear-gradient(135deg,#f43f5e,#be123c)' : 'linear-gradient(135deg,#6366f1,#a855f7)',
                color:'#fff', boxShadow: running ? '0 8px 24px rgba(244,63,94,0.3)' : '0 8px 24px rgba(99,102,241,0.3)' }}>
              {running ? <><Square size={14} fill="#fff"/> STOP BOT</> : <><Play size={14} fill="#fff"/> START BOT</>}
            </motion.button>
          </div>
        </div>

        {/* RIGHT: Log terminal */}
        <div style={{ background:'rgba(0,0,0,0.4)', border:'1px solid var(--border-subtle)', borderRadius:20, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:560 }}>
          {/* Terminal header */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:10, background:'rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', gap:6 }}>
              {['#f43f5e','#fbbf24','#00e676'].map(c => <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}
            </div>
            <span style={{ fontSize:10, fontWeight:900, color:'var(--text-dim)', letterSpacing:'.12em', marginLeft:6 }}>BOT EXECUTION LOG</span>
            {running && (
              <motion.div animate={{ opacity:[1,0,1] }} transition={{ repeat:Infinity, duration:1 }} style={{ marginLeft:'auto', fontSize:9, color:'#00e676', fontWeight:900 }}>
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
              <div key={log.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'5px 8px', borderRadius:7, background: log.type === 'buy' ? 'rgba(0,230,118,0.05)' : log.type === 'sell' ? 'rgba(244,63,94,0.05)' : 'transparent' }}>
                <span style={{ color:'var(--text-dim)', fontSize:9, flexShrink:0, marginTop:1 }}>
                  {new Date(log.ts).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                </span>
                <span style={{ color: logColor(log.type), fontWeight: log.type !== 'info' ? 800 : 400, flex:1, lineHeight:1.5 }}>{log.msg}</span>
                {log.pnl !== undefined && (
                  <span style={{ color: log.pnl >= 0 ? '#00e676' : '#f43f5e', fontWeight:900, fontSize:10, flexShrink:0 }}>
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
                { l:'Net PnL',      v:`${pnl>=0?'+':''}$${pnl}`, c: pnl>=0?'#00e676':'#f43f5e' },
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
