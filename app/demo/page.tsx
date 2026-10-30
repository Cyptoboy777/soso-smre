import Link from 'next/link';

export default function DemoPage() {
  return (
    <div style={{ maxWidth: 720, display: 'grid', gap: 24 }}>
      <header>
        <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', letterSpacing: '-0.035em' }}>
          Judge path — 3 clicks
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          No wallet. No login. Works with or without API keys (fallback panels are labelled).
        </p>
      </header>

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
        {[
          {
            n: '1',
            title: 'Open the Desk',
            body: 'See live/fallback SoSoValue ETF flows, hot news, SSI, and the AI/rules thesis with confidence.',
            href: '/',
            cta: 'Go to Desk',
          },
          {
            n: '2',
            title: 'Read the risk gate',
            body: 'Pass/fail reasons for size, drawdown, geometry, confidence, and news-shock pause. Tick confirm.',
            href: '/#',
            cta: 'Stay on Desk',
          },
          {
            n: '3',
            title: 'Execute + check track record',
            body: 'Place a SoDEX testnet limit order (or labelled dry-run). Then open the public track record.',
            href: '/track-record',
            cta: 'Open track record',
          },
        ].map((s) => (
          <li key={s.n} className="panel" style={{ padding: 20, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>
                <span style={{ color: 'var(--accent)', marginRight: 8 }}>{s.n}.</span>
                {s.title}
              </strong>
              <Link href={s.href} className="btn btn-primary" style={{ minHeight: 36, padding: '0 14px' }}>
                {s.cta}
              </Link>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>{s.body}</p>
          </li>
        ))}
      </ol>

      <section className="panel" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>What is live vs needs keys</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>Always:</strong> Desk UI, risk gate, dry-run orders, track
            record logging, labelled fallbacks.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>SOSOVALUE_API_KEY:</strong> live ETF flows, hot news, SSI.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>GEMINI_API_KEY:</strong> LLM thesis (else deterministic rules).
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>SODEX_API_KEY + SODEX_API_SECRET:</strong> real testnet limit
            orders (else dry-run).
          </li>
        </ul>
      </section>
    </div>
  );
}
