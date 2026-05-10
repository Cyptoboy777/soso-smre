'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Newspaper, Brain, Bot, BarChart2, Wallet, BookOpen } from 'lucide-react';

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',      Icon: LayoutDashboard },
  { href: '/breaking-news',   label: 'Breaking News',  Icon: Newspaper },
  { href: '/ai-analysis',     label: 'AI Analysis',    Icon: Brain },
  { href: '/ai-trade-agent',  label: 'AI Trade Agent', Icon: Bot },
  { href: '/etf-dashboard',   label: 'ETF Dashboard',  Icon: BarChart2 },
  { href: '/portfolio',       label: 'Portfolio',      Icon: Wallet },
  { href: '/guidelines',      label: 'Guidelines',     Icon: BookOpen },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{ width: 240, background: '#0d0d0d', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '18px 18px 8px', fontSize: 10, color: '#333', fontWeight: 700, letterSpacing: '.15em' }}>NAVIGATION</div>
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 12px', borderRadius: 8, position: 'relative',
                  background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                  color: active ? '#f97316' : '#666',
                  transition: 'all 0.15s', cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#bbb'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#666'; }}
              >
                {active && (
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 22, background: '#f97316', borderRadius: 2, boxShadow: '0 0 8px rgba(249,115,22,0.6)' }} />
                )}
                <Icon size={16} style={{ marginLeft: active ? 4 : 0, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div style={{ borderTop: '1px solid #1a1a1a', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 6px #00e676' }} />
        <span style={{ fontSize: 11, color: '#444', fontWeight: 600, letterSpacing: '.08em' }}>SYSTEM ACTIVE</span>
      </div>
    </aside>
  );
}
