'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { SmoothScroll } from './SmoothScroll';
import { LocaleProvider, LocaleSwitcher, useLocale } from './LocaleProvider';
import { ThemeToggle } from './ThemeToggle';

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const NAV = [
    { href: '/', label: t.navTrade },
    { href: '/desk', label: t.navDesk },
    { href: '/start', label: t.navStart },
    { href: '/stats', label: t.navStats },
    { href: '/track-record', label: t.navTrack },
  ];

  return (
    <div className="shell-root">
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link href="/" aria-label="FlowSentinel home" className="shell-brand">
            <Logo />
          </Link>
          <nav className="shell-nav" aria-label="Primary">
            {NAV.map((n) => {
              const active = n.href === '/' ? pathname === '/' || pathname.startsWith('/trade') : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="nav-pill"
                  data-active={active ? 'true' : 'false'}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="shell-actions">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
      </header>
      <main id="main" className="shell-main">
        <SmoothScroll>{children}</SmoothScroll>
      </main>
      <footer className="shell-footer">
        <p className="shell-disclaimer">{t.footerRisk}</p>
        <div className="shell-footer-links">
          <Link href="/">{t.navTrade}</Link>
          <Link href="/desk">{t.navDesk}</Link>
          <Link href="/start">{t.navStart}</Link>
          <Link href="/stats">{t.navStats}</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
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
