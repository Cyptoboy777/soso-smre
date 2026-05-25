'use client';

import { useEffect, useState } from 'react';
import { Bell, LogOut, Send, Zap, TrendingUp, TrendingDown, Activity, Search } from 'lucide-react';
import { useAuth } from '@/components/FirebaseProvider';
import { Logo } from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';

interface PriceTick {
  symbol: string;
  price: string;
  change: string;
}

const FG_LABELS: Record<string, { label: string; color: string }> = {
  'Extreme Fear':  { label: 'Extreme Fear',  color: '#f43f5e' },
  'Fear':          { label: 'Fear',           color: '#f97316' },
  'Neutral':       { label: 'Neutral',        color: '#eab308' },
  'Greed':         { label: 'Greed',          color: '#00c853' },
  'Extreme Greed': { label: 'Extreme Greed',  color: '#00e676' },
};

function fgClass(value: number): string {
  if (value < 25) return 'Extreme Fear';
  if (value < 45) return 'Fear';
  if (value < 55) return 'Neutral';
  if (value < 75) return 'Greed';
  return 'Extreme Greed';
}

function PriceBadge({
  label,
  price,
  change,
  accent,
}: {
  label: string;
  price: string | null;
  change: string | null;
  accent?: string;
}) {
  const isPos = change && !change.startsWith('-');
  const changeColor = isPos ? 'var(--accent-green)' : '#f43f5e';
  return (
    <div style={{
      padding: '0 16px', flexShrink: 0,
      borderRight: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.14em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 13, fontWeight: 800,
          color: accent ?? 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
        }}>
          {price ?? '---'}
        </span>
        {change && (
          <span style={{
            fontSize: 9, fontWeight: 900, color: changeColor,
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPos ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  );
}

function FearGreedWidget({ value, label }: { value: number; label: string }) {
  const meta = FG_LABELS[label] ?? { label, color: '#888' };
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div style={{ padding: '0 16px', flexShrink: 0 }}>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.14em', marginBottom: 4 }}>
        FEAR & GREED
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Compact arc or pill */}
        <div style={{ width: 56, height: 6, borderRadius: 99, position: 'relative', overflow: 'visible',
          background: 'linear-gradient(to right, #f43f5e, #f97316, #eab308, #00e676)',
          boxShadow: '0 0 8px rgba(0,0,0,0.3)',
        }}>
          <motion.div
            animate={{ left: `${pct}%` }}
            transition={{ type: 'spring', damping: 20, stiffness: 80 }}
            style={{
              position: 'absolute', top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: '#fff',
              boxShadow: `0 0 6px ${meta.color}`,
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: meta.color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
            {value}
          </div>
          <div style={{ fontSize: 9, color: meta.color, fontWeight: 700, opacity: 0.8 }}>
            {meta.label}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TopBarProps {
  onCmdOpen?: () => void;
}

export default function TopBar({ onCmdOpen }: TopBarProps) {
  const { user, walletAddress, signOut } = useAuth();
  const [btc, setBtc] = useState<number | null>(null);
  const [eth, setEth] = useState<number | null>(null);
  const [soso, setSoso] = useState<number | null>(null);
  const [btcChange, setBtcChange] = useState<string | null>(null);
  const [ethChange, setEthChange] = useState<string | null>(null);
  const [sosoChange, setSosoChange] = useState<string | null>(null);
  const [mcap, setMcap] = useState<string | null>(null);
  const [fgValue, setFgValue] = useState<number | null>(null);
  const [fgLabel, setFgLabel] = useState<string>('Neutral');
  const [priceError, setPriceError] = useState('');
  const [source, setSource] = useState<'cg' | 'sodex'>('cg');
  const [notifOpen, setNotifOpen] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/prices');
        if (!r.ok) throw new Error('fail');
        const d = await r.json();
        setBtc(d.btc);
        setEth(d.eth);
        setSoso(d.soso || 0.395);
        const findChange = (s: string, alt?: string) => {
          const found = d.prices?.find((p: PriceTick) => p.symbol === s)?.change
            || (alt ? d.prices?.find((p: PriceTick) => p.symbol === alt)?.change : null)
            || '0.00';
          return found;
        };
        setBtcChange(findChange('BTCUSDT'));
        setEthChange(findChange('ETHUSDT'));
        setSosoChange(findChange('SOSOUSDT', 'WSOSOUSDT'));
        setMcap(d.globalMarketCap || null);
        setSource(d.source === 'sodex' ? 'sodex' : 'cg');
        setPriceError('');
      } catch {
        setPriceError('LIVE PRICE ERROR');
      }
    };
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  // Fear & Greed Index — Alternative.me
  useEffect(() => {
    const loadFG = async () => {
      try {
        const r = await fetch('https://api.alternative.me/fng/?limit=1');
        const d = await r.json();
        const val = parseInt(d?.data?.[0]?.value ?? '50');
        const lbl = d?.data?.[0]?.value_classification ?? 'Neutral';
        setFgValue(val);
        setFgLabel(lbl);
      } catch {
        // silent
      }
    };
    loadFG();
    const id = setInterval(loadFG, 60_000 * 5);
    return () => clearInterval(id);
  }, []);

  // Auto market watcher
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const watcher = async () => {
      const chatId = localStorage.getItem('tg_chat_id');
      if (!chatId) return;
      const lastAlert = localStorage.getItem('last_tg_alert');
      const now = Date.now();
      if (!lastAlert || now - parseInt(lastAlert) > 3 * 60 * 60 * 1000) {
        try {
          const r = await fetch('/api/prices');
          const d = await r.json();
          const top = d.prices?.[0] || { symbol: 'BTCUSDT', price: '90000', change: '+2.5' };
          const msg =
            `🔔 <b>SYSTEM MARKET WATCHER</b>\n\n` +
            `Top Volatility: <b>${top.symbol}</b>\n` +
            `Current Price: <b>$${parseFloat(top.price).toLocaleString()}</b>\n` +
            `24h Change: <b>${top.change}%</b>\n\n` +
            `<i>AI Insight: High momentum detected.</i>`;
          await fetch('/api/telegram-alert', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message: msg }),
          });
          localStorage.setItem('last_tg_alert', now.toString());
        } catch {}
      }
    };
    watcher();
    const id = setInterval(watcher, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header style={{
      background: 'var(--bg-topbar)',
      backdropFilter: 'blur(40px) saturate(2)',
      WebkitBackdropFilter: 'blur(40px) saturate(2)',
      borderBottom: '1px solid rgba(124,58,237,0.15)',
      height: 58,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 20,
      paddingRight: 16,
      flexShrink: 0,
      zIndex: 50,
      position: 'relative',
      boxShadow: '0 4px 30px rgba(0,0,0,0.5), 0 1px 0 rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Premium gradient top edge — purple→cyan→orange */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #7c3aed 0%, #22d3ee 50%, #f97316 100%)',
        opacity: 0.7,
      }} />
      {/* Bottom accent */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, var(--accent-orange), var(--accent-purple), transparent)',
        opacity: 0.15,
      }} />

      {/* ─── LOGO ─── */}
      <div style={{ paddingRight: 16, borderRight: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <Logo
          mode="icon"
          style={{ width: 28, height: 28 }}
        />
      </div>

      {/* ─── BTC ─── */}
      <PriceBadge
        label={source === 'sodex' ? 'vBTC/vUSDC' : 'BTC/USDT'}
        price={btc !== null ? `$${fmt(btc)}` : null}
        change={btcChange}
      />

      {/* ─── ETH ─── */}
      <PriceBadge
        label={source === 'sodex' ? 'vETH/vUSDC' : 'ETH/USDT'}
        price={eth !== null ? `$${fmt(eth)}` : null}
        change={ethChange}
      />

      {/* ─── SOSO ─── */}
      <PriceBadge
        label={source === 'sodex' ? 'WSOSO/vUSDC' : 'SOSO/USDT'}
        price={soso !== null ? `$${soso.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : null}
        change={sosoChange}
        accent="var(--accent-orange)"
      />

      {/* ─── MCAP ─── */}
      <div style={{ padding: '0 16px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.14em', marginBottom: 3 }}>GLOBAL MCAP</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
          {mcap ? `$${mcap}` : '---'}
        </div>
      </div>

      {/* ─── FEAR & GREED ─── */}
      {fgValue !== null ? (
        <FearGreedWidget value={fgValue} label={fgLabel} />
      ) : (
        <div style={{ padding: '0 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.14em', marginBottom: 4 }}>FEAR & GREED</div>
          <div className="skeleton" style={{ width: 80, height: 20 }} />
        </div>
      )}

      {priceError && (
        <div style={{ padding: '0 12px', color: 'var(--accent-red)', fontSize: 9, fontWeight: 900, letterSpacing: '.1em' }}>
          {priceError}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* ─── RIGHT SECTION ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Command palette shortcut */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCmdOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-bold)',
            borderRadius: 10, cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}
          title="Command Palette (Ctrl+K)"
        >
          <Search size={14} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Search</span>
          <span style={{
            fontSize: 10, color: 'var(--text-dim)',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
            padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)',
          }}>⌘K</span>
        </motion.button>

        {/* Telegram Signals */}
        <motion.a
          href="https://t.me/sodexAI_bot"
          target="_blank" rel="noopener noreferrer"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 12px',
            background: 'linear-gradient(135deg, #2563eb, #6366f1)',
            borderRadius: 10, textDecoration: 'none',
            color: '#fff',
            boxShadow: '0 0 16px rgba(99,102,241,0.3)',
          }}
        >
          <Send size={14} fill="#fff" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: '.06em', lineHeight: 1.2 }}>TRADING</div>
            <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: '.06em', lineHeight: 1.2 }}>SIGNALS</div>
          </div>
        </motion.a>

        {/* User badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-bold)',
          borderRadius: 10, cursor: 'pointer',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: walletAddress
              ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
              : 'linear-gradient(135deg, var(--accent-orange), var(--accent-orange2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 900, color: '#fff',
            boxShadow: '0 0 8px rgba(99,102,241,0.3)',
          }}>
            {walletAddress ? 'W' : (user?.displayName ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}
          </div>
          <span style={{
            fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700,
            maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: walletAddress ? 'var(--font-mono)' : 'inherit',
          }}>
            {walletAddress
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : (user?.displayName ?? user?.email)}
          </span>
        </div>

        {/* Logout */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => signOut()}
          title="Sign out"
          style={{
            width: 36, height: 36,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-dim)',
            transition: 'all 0.15s',
          }}
        >
          <LogOut size={15} />
        </motion.button>
      </div>
    </header>
  );
}
