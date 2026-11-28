'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050506', color: '#e4e4e7', fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 380 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>SoSwapDEX hit a problem</div>
        <p style={{ marginTop: 8, fontSize: 14, color: '#a1a1aa', lineHeight: 1.5 }}>Your wallet and funds are not affected. Reload the page to continue.</p>
        <button onClick={() => reset()} style={{ marginTop: 16, height: 40, padding: '0 18px', borderRadius: 12, border: 0, background: '#f97316', color: '#000', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
      </div>
    </div>
  );
}
