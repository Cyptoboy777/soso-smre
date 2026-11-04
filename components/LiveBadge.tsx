import type { DataSource } from '@/types/flow';

export function LiveBadge({ source, note }: { source: DataSource; note?: string }) {
  const label =
    source === 'live' ? 'Live data' : source === 'fallback' ? 'Cached data' : 'Unavailable';
  return (
    <span className={`badge ${source}`} title={note}>
      <span className="dot" aria-hidden />
      {label}
    </span>
  );
}
