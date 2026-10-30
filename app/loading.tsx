export default function Loading() {
  return (
    <div className="panel" style={{ padding: 32 }} aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 120, width: '100%' }} />
    </div>
  );
}
