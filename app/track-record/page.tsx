'use client';

import { useEffect, useState } from 'react';
import { LiveBadge } from '@/components/LiveBadge';
import type { TrackRecordEntry } from '@/types/flow';

interface Payload {
  stats: {
    total: number;
    resolved: number;
    wins: number;
    losses: number;
    hitRate: number | null;
  };
  entries: TrackRecordEntry[];
  marksSource: { source: 'live' | 'fallback' | 'unavailable'; note?: string };
}

export default function TrackRecordPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/track-record', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        setData((await res.json()) as Payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', letterSpacing: '-0.035em' }}>
          Public track record
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 560 }}>
          Honest log of every thesis. Outcomes resolve only from real mark prices — we never invent PnL.
        </p>
      </header>

      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!data && !error && <div className="skel" style={{ height: 180 }} />}

      {data && (
        <>
          <section
            className="panel"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
              gap: 0,
            }}
          >
            <Stat label="Ideas" value={String(data.stats.total)} />
            <Stat label="Resolved" value={String(data.stats.resolved)} />
            <Stat label="Wins" value={String(data.stats.wins)} />
            <Stat label="Losses" value={String(data.stats.losses)} />
            <Stat
              label="Hit rate"
              value={data.stats.hitRate == null ? '—' : `${data.stats.hitRate}%`}
              hint={data.stats.hitRate == null ? 'No scored outcomes yet' : undefined}
            />
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <LiveBadge source={data.marksSource.source} note={data.marksSource.note} />
          </div>

          <div className="panel" style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                  {['When', 'Side', 'Symbol', 'Entry', 'Confidence', 'Mode', 'Outcome', 'PnL %'].map((h) => (
                    <th key={h} style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.entries.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, color: 'var(--text-muted)' }}>
                      No ideas logged yet. Generate a thesis on the Desk to start the record.
                    </td>
                  </tr>
                )}
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                      {new Date(e.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })} IST
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>{e.side}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>{e.symbol}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                      ${e.entry.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>{e.confidence}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>{e.orderMode}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>{e.outcome}</td>
                    <td
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--line)',
                        color:
                          e.pnlPct == null
                            ? 'var(--text-muted)'
                            : e.pnlPct >= 0
                              ? 'var(--success)'
                              : 'var(--danger)',
                      }}
                    >
                      {e.pnlPct == null ? '—' : `${e.pnlPct >= 0 ? '+' : ''}${e.pnlPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ padding: 20, borderRight: '1px solid var(--line)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div className="tabular" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
