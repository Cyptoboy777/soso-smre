import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
      <h1 style={{ marginTop: 0 }}>404</h1>
      <p style={{ color: 'var(--text-muted)' }}>That page is not on the FlowSentinel desk.</p>
      <Link className="btn btn-primary" href="/" style={{ display: 'inline-flex', marginTop: 12 }}>
        Return home
      </Link>
    </div>
  );
}
