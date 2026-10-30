import Link from 'next/link';
import { Logo } from './Logo';

const NAV = [
  { href: '/', label: 'Desk' },
  { href: '/track-record', label: 'Track record' },
  { href: '/demo', label: 'Judge path' },
];

export function Shell({ children }: { children: React.ReactNode }) {
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
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="btn btn-ghost"
                style={{ minHeight: 36, padding: '0 12px', fontSize: 14, fontWeight: 500 }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <span className="badge" style={{ display: 'none' }} />
          <span
            className="badge"
            style={{
              borderColor: 'rgba(255,79,32,0.3)',
              color: 'var(--accent-soft)',
            }}
          >
            Wave 3 · Judge mode
          </span>
        </div>
      </header>
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '28px 20px 64px' }}>
        {children}
      </main>
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '20px',
          color: 'var(--text-faint)',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        FlowSentinel · SoSoValue + SoDEX · Public track record · Never presents fallback as live
      </footer>
    </div>
  );
}
