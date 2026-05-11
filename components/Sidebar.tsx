'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Newspaper, Brain, Bot, BarChart2, Wallet, BookOpen, History, Sun, Moon, Activity } from 'lucide-react';
import { useAuth } from '@/components/FirebaseProvider';

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',      Icon: LayoutDashboard },
  { href: '/breaking-news',   label: 'Breaking News',  Icon: Newspaper },
  { href: '/ai-analysis',     label: 'AI Analysis',    Icon: Brain },
  { href: '/ai-trade-agent',  label: 'AI Trade Agent', Icon: Bot },
  { href: '/backtest',        label: 'Backtest AI',    Icon: History },
  { href: '/etf-dashboard',   label: 'ETF Dashboard',  Icon: BarChart2 },
  { href: '/sodex-markets',   label: 'SoDEX Markets',  Icon: Activity },
  { href: '/portfolio',       label: 'Portfolio',      Icon: Wallet },
  { href: '/settings',        label: 'Settings',       Icon: Bot },
  { href: '/guidelines',      label: 'Guidelines',     Icon: BookOpen },
];

interface SidebarProps {
  theme?: 'night' | 'day';
  setTheme?: (t: 'night' | 'day') => void;
}

export default function Sidebar({ theme, setTheme }: SidebarProps) {
  const path = usePathname();
  const { user, walletAddress, signIn, signOut, connectWallet } = useAuth();

  return (
    <aside style={{ width: 240, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'all 0.4s ease' }}>
      <div style={{ padding: '18px 18px 8px', fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.15em' }}>NAVIGATION</div>
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 12px', borderRadius: 10, position: 'relative',
                  background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                  color: active ? 'var(--accent-orange)' : 'var(--text-secondary)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
                }}
              >
                {active && (
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 22, background: 'var(--accent-orange)', borderRadius: 2, boxShadow: '0 0 8px rgba(249,115,22,0.6)' }} />
                )}
                <Icon size={16} style={{ marginLeft: active ? 4 : 0, flexShrink: 0, transition: 'transform 0.3s' }} />
                <span style={{ fontSize: 13, fontWeight: active ? 800 : 500, letterSpacing: active ? '0.02em' : 'normal' }}>{label}</span>
              </div>
            </Link>
          );
        })}

        {/* Theme Toggle in Sidebar */}
        <div style={{ marginTop: 24, padding: '0 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.12em', marginBottom: 12, marginLeft: 4 }}>APPEARANCE</div>
          <button 
            onClick={() => setTheme?.(theme === 'night' ? 'day' : 'night')}
            style={{ 
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px', borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              transition: 'all 0.2s', cursor: 'pointer',
              fontSize: 12, fontWeight: 700
            }}
          >
            {theme === 'night' ? <Moon size={15} color="var(--accent-orange)" /> : <Sun size={15} color="var(--accent-orange)" />}
            <span>{theme === 'night' ? 'Night Mode' : 'Day Mode'}</span>
          </button>
        </div>
      </nav>

      {/* WALLET / AUTH SECTION */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
        {!user && !walletAddress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={signIn} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border-bold)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>LOGIN</button>
            <button onClick={connectWallet} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--accent-orange)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>CONNECT WALLET</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {walletAddress && (
              <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)', padding: '10px', borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: 'var(--accent-blue)', fontWeight: 800, marginBottom: 4 }}>WALLET</div>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</div>
              </div>
            )}
            <button onClick={signOut} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border-bold)', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, borderRadius: 8, cursor: 'pointer' }}>LOGOUT</button>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
        <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '.08em' }}>SYSTEM ONLINE</span>
      </div>
    </aside>
  );
}
