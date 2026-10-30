'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel" style={{ padding: 32 }} role="alert">
      <h1 style={{ marginTop: 0 }}>Something broke</h1>
      <p style={{ color: 'var(--text-muted)' }}>{error.message || 'Unexpected error'}</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
