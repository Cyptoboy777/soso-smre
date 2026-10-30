'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { SmoothScroll } from './SmoothScroll';

const NAV = [
  { href: '/', label: 'Desk' },
  { href: '/track-record', label: 'Track record' },
  { href: '/demo', label: 'Judge path' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backdropFilter: 'blur(14px)',
          background: 'rgba(10,10,10,0.78)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <Link href="/" aria-label="FlowSentinel home">
            <Logo />
          </Link>
          <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} aria-label="Primary">
            {NAV.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="btn btn-ghost nav-link"
                  data-active={active ? 'true' : 'false'}
                  style={{ minHeight: 36, padding: '0 12px', fontSize: 14, fontWeight: 500 }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <span
            className="badge wave-badge"
            style={{ borderColor: 'rgba(255,79,32,0.3)', color: 'var(--accent-soft)' }}
          >
            Wave 3 · Judge mode
          </span>
        </div>
      </header>
      <main id="main" style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '28px 20px 64px' }}>
        <SmoothScroll>{children}</SmoothScroll>
      </main>
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '20px',
          color: 'var(--text-faint)',
          fontSize: 13,
          textAlign: 'center',
          display: 'grid',
          gap: 8,
        }}
      >
        <div>
          FlowSentinel · SoSoValue + SoDEX · Public track record · Never presents fallback as live
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.45 }}>
          Not financial advice. SoDEX path is testnet-only. Voice never places orders.
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/demo">Judge path</Link>
        </div>
      </footer>
    </div>
  );
}
