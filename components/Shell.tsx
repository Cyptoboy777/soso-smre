'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { SmoothScroll } from './SmoothScroll';
import { LocaleProvider, LocaleSwitcher, useLocale } from './LocaleProvider';

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const NAV = [
    { href: '/', label: t.navDesk },
    { href: '/start', label: t.navStart },
    { href: '/stats', label: t.navStats },
    { href: '/track-record', label: t.navTrack },
    { href: '/judge', label: t.navJudge },
  ];

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
          className="shell-header-inner"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/" aria-label="FlowSentinel home">
            <Logo />
          </Link>
          <nav
            style={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'center' }}
            aria-label="Primary"
          >
            {NAV.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="btn btn-ghost nav-link"
                  data-active={active ? 'true' : 'false'}
                  style={{ minHeight: 36, padding: '0 10px', fontSize: 13, fontWeight: 500 }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LocaleSwitcher />
            <span
              className="badge wave-badge"
              style={{ borderColor: 'rgba(255,79,32,0.3)', color: 'var(--accent-soft)' }}
            >
              {t.badgeWave}
            </span>
          </div>
        </div>
      </header>
      <main
        id="main"
        style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 16px 64px' }}
      >
        <SmoothScroll>{children}</SmoothScroll>
      </main>
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '20px 16px',
          color: 'var(--text-faint)',
          fontSize: 13,
          textAlign: 'center',
          display: 'grid',
          gap: 8,
        }}
      >
        <div>{t.footerLine}</div>
        <div style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.45 }}>{t.footerRisk}</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/start">Start</Link>
          <Link href="/stats">Stats</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/judge">Judge path</Link>
        </div>
      </footer>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ShellInner>{children}</ShellInner>
    </LocaleProvider>
  );
}
