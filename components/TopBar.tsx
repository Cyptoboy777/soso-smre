'use client';
import { useEffect, useState } from 'react';
import { Bell, LogOut, Send, Zap } from 'lucide-react';
import { useAuth } from '@/components/FirebaseProvider';
import { Logo } from '@/components/Logo';

export default function TopBar() {
  const { user, walletAddress, signOut } = useAuth();
  const [btc, setBtc] = useState<number | null>(null);
  const [eth, setEth] = useState<number | null>(null);
  const [soso, setSoso] = useState<number | null>(null);
  const [mcap, setMcap] = useState<string | null>(null);
  const [priceError, setPriceError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/prices');
        if (!r.ok) throw new Error('Live prices unavailable');
        const d = await r.json() as { btc: number; eth: number; soso: number; globalMarketCap?: string };
        setBtc(d.btc);
        setEth(d.eth);
        setSoso(d.soso);
        setMcap(d.globalMarketCap || null);
        setPriceError('');
      } catch {
        setPriceError('LIVE PRICE ERROR');
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  // AUTO MARKET WATCHER (Every 3 hours)
  useEffect(() => {
    const watcher = async () => {
      const chatId = localStorage.getItem('tg_chat_id');
      if (!chatId) return;

      const lastAlert = localStorage.getItem('last_tg_alert');
      const now = Date.now();
      const threeHours = 3 * 60 * 60 * 1000;

      if (!lastAlert || (now - parseInt(lastAlert)) > threeHours) {
        // Fetch top coin data for alert
        try {
          const r = await fetch('/api/prices');
          const d = await r.json();
          const topCoin = d.prices?.[0] || { symbol: 'BTCUSDT', price: '90000', change: '+2.5' };
          
          const msg = `🔔 <b>SYSTEM MARKET WATCHER</b>\n\n` +
                      `Top Volatility: <b>${topCoin.symbol}</b>\n` +
                      `Current Price: <b>$${parseFloat(topCoin.price).toLocaleString()}</b>\n` +
                      `24h Change: <b>${topCoin.change}%</b>\n\n` +
                      `<i>AI Insight: High momentum detected. Check AI Analysis for exact entry zones.</i>`;

          await fetch('/api/telegram-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message: msg })
          });
          
          localStorage.setItem('last_tg_alert', now.toString());
        } catch (e) {
          console.error("Market Watcher Error:", e);
        }
      }
    };

    watcher();
    const watcherId = setInterval(watcher, 60000); // Check every minute
    return () => clearInterval(watcherId);
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const S: React.CSSProperties = {
    background: 'var(--bg-sidebar)',
    borderBottom: '1px solid var(--border-subtle)',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    flexShrink: 0,
    zIndex: 50,
    gap: 0,
    transition: 'all 0.4s ease'
  };
  const div = { width: 1, height: 24, background: 'var(--border-bold)', flexShrink: 0 } as React.CSSProperties;
  const lbl = { fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em', marginBottom: 4 } as React.CSSProperties;
  const val = { fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' } as React.CSSProperties;

  return (
    <header style={S}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
        <Logo style={{ width: 34, height: 34 }} />
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>SoSo Smre</div>
          <div style={{ fontSize: 8, color: 'var(--accent-orange)', fontWeight: 900, letterSpacing: '.15em', marginTop: 2 }}>SMART MONEY RESEARCH ENGINE</div>
        </div>
      </div>
      <div style={div} />
      {/* BTC */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={lbl}>BTC/USDT</div>
        <div style={val}>{btc === null ? '--' : `$${fmt(btc)}`}</div>
      </div>
      <div style={div} />
      {/* ETH */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={lbl}>ETH/USDT</div>
        <div style={val}>{eth === null ? '--' : `$${fmt(eth)}`}</div>
      </div>
      <div style={div} />
      {/* SOSO */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={lbl}>SOSO/USDT</div>
        <div style={{ ...val, color: 'var(--accent-orange)' }}>{soso === null ? '--' : `$${soso.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}</div>
      </div>
      <div style={div} />
      {/* MCAP */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={lbl}>GLOBAL MCAP</div>
        <div style={{ ...val, color: 'var(--accent-green)' }}>{mcap === null ? '--' : `$${mcap}`}</div>
      </div>
      <div style={div} />
      {priceError && <div style={{ padding: '0 20px', color: 'var(--accent-red)', fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>{priceError}</div>}
      <div style={{ flex: 1 }} />
      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Telegram Signals Button */}
        <a 
          href="https://t.me/sodexAI_bot" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            padding: '6px 14px', 
            background: 'var(--accent-blue)', 
            borderRadius: 12, 
            textDecoration: 'none',
            color: '#fff',
            boxShadow: '0 0 12px rgba(59,130,246,0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
        >
          <Send size={14} fill="#fff" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.05em', lineHeight: 1 }}>TRADING</div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.05em', lineHeight: 1 }}>SIGNALS</div>
          </div>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, cursor: 'pointer' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: walletAddress ? 'var(--accent-blue)' : 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>
            {walletAddress ? 'W' : (user?.displayName ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: walletAddress ? 'monospace' : 'inherit' }}>
            {walletAddress ? `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}` : (user?.displayName ?? user?.email)}
          </span>
        </div>
        <button onClick={() => signOut()} title="Sign out" style={{ width: 38, height: 38, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', transition: 'all 0.2s' }}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
