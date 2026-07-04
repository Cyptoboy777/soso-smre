'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MarketSentiment from '@/components/MarketSentiment';
import TopMovers from '@/components/TopMovers';
import SoEva from '@/components/SoEva';
import TradingViewChart from '@/components/TradingViewChart';
import MarketFlowChart from '@/components/MarketFlowChart';

interface Prices { btc: number; eth: number; sol: number; bnb: number; globalMarketCap: string; }
type AlphaStatus = 'idle' | 'analyzing' | 'sending' | 'done' | 'error';

export default function DashboardPage() {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [error, setError] = useState('');
  const [alphaStatus, setAlphaStatus] = useState<AlphaStatus>('idle');
  const [alphaMsg, setAlphaMsg] = useState('');

  const sendAlpha = async () => {
    const chatId = localStorage.getItem('tg_chat_id');
    if (!chatId) {
      alert('📱 Please go to Settings and connect your Telegram Chat ID first!');
      return;
    }
    setAlphaStatus('analyzing');
    setAlphaMsg('Analyzing live markets + news with Gemini AI...');
    try {
      // Step 1: Generate AI-powered alpha
      const alphaRes = await fetch('/api/daily-alpha', { method: 'POST' });
      const alphaData = await alphaRes.json();
      if (!alphaRes.ok) throw new Error(alphaData.error ?? 'Alpha generation failed');

      setAlphaStatus('sending');
      setAlphaMsg('Sending to your Telegram...');

      // Step 2: Send to Telegram
      const tgRes = await fetch('/api/telegram-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: alphaData.message }),
      });
      const tgData = await tgRes.json();
      if (!tgRes.ok) throw new Error(tgData.error ?? 'Telegram send failed');

      setAlphaStatus('done');
      setAlphaMsg('✅ Today\'s Alpha sent to your Telegram!');
    } catch (e) {
      setAlphaStatus('error');
      setAlphaMsg(`❌ ${e instanceof Error ? e.message : 'Failed'}`);
    }
    setTimeout(() => { setAlphaStatus('idle'); setAlphaMsg(''); }, 5000);
  };



  useEffect(() => {
    let attempts = 0;
    const load = async () => {
      try {
        const r = await fetch('/api/prices');
        if (!r.ok) throw new Error('Live market data unavailable');
        const d = await r.json() as Prices;
        // Only update if we get real data (not zeros)
        if (d.btc > 0 || d.eth > 0) {
          setPrices(d);
          setError('');
          return; // success — stop retrying
        }
        throw new Error('Prices not yet available');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Live market data unavailable');
        // Retry up to 5 times with 3s delay while waiting for SoDEX/CoinGecko
        if (attempts++ < 5) setTimeout(load, 3_000);
      }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const cards = [
    { label: 'BTC/USDT', value: (prices?.btc ?? 0) > 0 ? `$${fmt(prices!.btc, 0)}` : '--', sub: 'Bitcoin', color: '#f7931a' },
    { label: 'ETH/USDT', value: (prices?.eth ?? 0) > 0 ? `$${fmt(prices!.eth, 0)}` : '--', sub: 'Ethereum', color: '#627eea' },
    { label: 'SOL/USDT', value: (prices?.sol ?? 0) > 0 ? `$${fmt(prices!.sol, 2)}` : '--', sub: 'Solana', color: '#14f195' },
  ];

  return (
    <div className="fade-up" style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', minHeight: '100%' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div className="smart-status-indicator" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-orange)' }} />
            <h1 className="neon-glow-text" style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em', textTransform: 'uppercase', margin: 0 }}>Intelligence Terminal</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Global Market Cap: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{prices?.globalMarketCap ?? '--'}</span> 
            <span style={{ margin: '0 10px', opacity: 0.2 }}>|</span>
            Status: <span style={{ color: 'var(--text-primary)' }}>AI-AGENT ACTIVE</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexDirection: 'column', alignItems: 'flex-end' }}>
           <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
             <button
               onClick={sendAlpha}
               disabled={alphaStatus !== 'idle'}
               className="figma-btn"
               style={{
                 fontSize: 12, fontWeight: 900, cursor: alphaStatus !== 'idle' ? 'not-allowed' : 'pointer',
                 display: 'flex', alignItems: 'center', gap: 8,
                 background: alphaStatus === 'done' ? 'var(--accent-green)' : alphaStatus === 'error' ? '#f43f5e' : undefined,
                 boxShadow: alphaStatus !== 'idle' ? 'none' : undefined,
               }}
             >
               {alphaStatus === 'analyzing' && <div className="spin" style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />}
               {alphaStatus === 'sending'   && <div className="spin" style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />}
               {alphaStatus === 'analyzing' ? '🧠 AI Analyzing Markets...' :
                alphaStatus === 'sending'   ? '📡 Sending to Telegram...' :
                alphaStatus === 'done'      ? '✅ Alpha Sent!' :
                alphaStatus === 'error'     ? '❌ Failed' :
                '🚀 SEND TODAY\'S ALPHA'}
             </button>
             <div className="figma-badge">LIVE SYNC</div>
           </div>
           {alphaMsg && (
             <div style={{ fontSize: 11, color: alphaStatus === 'error' ? '#f43f5e' : '#94a3b8', fontWeight: 600, textAlign: 'right' }}>
               {alphaMsg}
             </div>
           )}
        </div>

      </div>

      {error && <div style={{ marginBottom: 24, color: 'var(--accent-red)', fontSize: 13, background: 'rgba(244,63,94,0.05)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(244,63,94,0.1)' }}>{error}</div>}


      {/* TOP ROW: Price Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} className="figma-card" style={{ borderRadius: 20, padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: c.color, filter: 'blur(50px)', opacity: 0.1 }} />
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.15em', marginBottom: 16 }}>{c.label}</div>
            <div className="neon-glow-text" style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace', marginBottom: 4, letterSpacing: '-0.02em' }}>{c.value}</div>
            <div style={{ fontSize: 12, color: c.color, fontWeight: 700, letterSpacing: '.05em', opacity: 0.8 }}>{c.sub.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* NEW: CAPITAL FLOW + ETF SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 40 }}>
        
        {/* Advance Flow Chart */}
        <div className="neon-border glass" style={{ borderRadius: 24, overflow: 'hidden' }}>
          <MarketFlowChart />
        </div>

        {/* ETF DASHBOARD SHIFTED HERE */}
        <div className="neon-border glass" style={{ borderRadius: 24, padding: 24, background: 'linear-gradient(180deg, #0a0a0a 0%, #050505 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 12, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '.12em' }}>US SPOT BTC ETF FLOWS</h2>
            <Link href="/etf-dashboard" style={{ fontSize: 10, color: 'var(--accent-orange)', fontWeight: 800, textDecoration: 'none' }}>VIEW ALL ↗</Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { ticker: 'IBIT', name: 'iShares Bitcoin Trust', inflow: '+$142.3M', pos: true },
              { ticker: 'FBTC', name: 'Fidelity Wise Origin', inflow: '+$84.1M', pos: true },
              { ticker: 'GBTC', name: 'Grayscale Bitcoin Trust', inflow: '-$12.5M', pos: false },
            ].map(e => (
              <div key={e.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent-orange)' }}>{e.ticker}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{e.name}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: e.pos ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'monospace' }}>{e.inflow}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 16, background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)', borderRadius: 12 }}>
             <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 800, marginBottom: 4 }}>TOTAL NET FLOW (24H)</div>
             <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>+$213.9M <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>↗</span></div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 20, marginBottom: 40 }}>
        
        {/* Market Sentiment */}
        <div className="neon-border glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <MarketSentiment />
        </div>

        {/* Top Movers */}
        <div className="neon-border glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <TopMovers />
        </div>

        {/* Quick Links / Status */}
        <div className="neon-border glass" style={{ borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
           <div>
             <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.15em', marginBottom: 24 }}>SYSTEM INFRASTRUCTURE</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Gemini 2.5 Flash', status: 'OPERATIONAL', color: 'var(--accent-blue)' },
                  { label: 'SoSoValue News', status: 'REAL-TIME', color: 'var(--accent-green)' },
                  { label: 'SoDEX Gateway', status: 'SECURE', color: 'var(--accent-orange)' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: 9, fontWeight: 900, color: s.color, letterSpacing: '.05em' }}>{s.status}</span>
                    </div>
                  </div>
                ))}
             </div>
           </div>
           <Link href="/portfolio" style={{ background: 'var(--text-primary)', color: 'var(--bg-main)', padding: '12px', borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 900, textDecoration: 'none', marginTop: 32, transition: 'transform 0.2s', letterSpacing: '.05em' }}>
             EXECUTE ANALYTICS
           </Link>
        </div>
      </div>

      {/* COMMAND CENTER SECTION */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 40 }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '.15em', marginBottom: 24 }}>NEURAL COMMAND CENTER</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { href: '/breaking-news',  label: 'BREAKING NEWS',  color: 'var(--accent-blue)', icon: '📰', desc: 'Real-time market alpha' },
            { href: '/ai-analysis',    label: 'AI ANALYSIS',    color: 'var(--accent-orange)', icon: '🤖', desc: 'Gemini + Groq signals' },
            { href: '/ai-trade-agent', label: 'TRADE AGENT',    color: 'var(--accent-green)', icon: '💱', desc: 'Execute paper trades' },
            { href: '/etf-dashboard',  label: 'ETF FLOWS',      color: '#a855f7', icon: '📊', desc: 'US Spot ETF dynamics' },
            { href: '/portfolio',      label: 'PORTFOLIO',      color: '#f59e0b', icon: '💼', desc: 'PnL & holdings tracker' },
            { href: '/guidelines',     label: 'GUIDELINES',     color: 'var(--text-secondary)', icon: '📋', desc: 'Platform protocol' },
          ].map(item => (
            <Link key={item.href} href={item.href} className="neon-border glass" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px', borderRadius: 20, textDecoration: 'none', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <div style={{ fontSize: 24, width: 48, height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '.02em' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

