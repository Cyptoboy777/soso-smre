'use client';
import { useEffect, useState } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/components/FirebaseProvider';

import { Logo } from '@/components/Logo';

export default function TopBar() {
  const { user, signOut } = useAuth();
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

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const S: React.CSSProperties = {
    background: '#0d0d0d',
    borderBottom: '1px solid #1e1e1e',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    flexShrink: 0,
    zIndex: 50,
    gap: 0,
  };
  const div = { width: 1, height: 30, background: '#222', flexShrink: 0 } as React.CSSProperties;
  const lbl = { fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '.1em', marginBottom: 3 } as React.CSSProperties;
  const val = { fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' } as React.CSSProperties;

  return (
    <header style={S}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 228, paddingRight: 18 }}>
        <Logo style={{ width: 38, height: 38 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1.2, letterSpacing: '.01em' }}>SoSo Smre</div>
          <div style={{ fontSize: 9, color: '#f97316', fontWeight: 700, letterSpacing: '.12em', marginTop: 2 }}>[SMART MONEY RESEARCH ENGINE]</div>
        </div>
      </div>
      <div style={div} />
      {/* BTC */}
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        <div style={lbl}>BTC/USDT</div>
        <div style={val}>{btc === null ? '--' : `$${fmt(btc)}`}</div>
      </div>
      <div style={div} />
      {/* ETH */}
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        <div style={lbl}>ETH/USDT</div>
        <div style={val}>{eth === null ? '--' : `$${fmt(eth)}`}</div>
      </div>
      <div style={div} />
      {/* SOSO */}
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        <div style={lbl}>SOSO/USDT</div>
        <div style={val}>{soso === null ? '--' : `$${soso.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}</div>
      </div>
      <div style={div} />
      {/* MCAP */}
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        <div style={lbl}>TOTAL MCAP</div>
        <div style={{ ...val, color: '#00e676' }}>{mcap === null ? '--' : `$${mcap}`}</div>
      </div>
      <div style={div} />
      {priceError && <div style={{ padding: '0 16px', color: '#f43f5e', fontSize: 10, fontWeight: 800, letterSpacing: '.12em' }}>{priceError}</div>}
      <div style={{ flex: 1 }} />
      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, cursor: 'pointer' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#000' }}>
            {(user?.displayName ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: '#ccc', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.displayName ?? user?.email}
          </span>
        </div>
        <button style={{ width: 34, height: 34, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Bell size={15} color="#666" />
        </button>
        <button onClick={() => signOut()} title="Sign out" style={{ width: 34, height: 34, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <LogOut size={15} color="#888" />
        </button>
      </div>
    </header>
  );
}
