'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from './LocaleProvider';
import { formatStatNumber } from '@/lib/sodex-builder-fee-stats';

export function BuilderStatsClient() {
  const { t } = useLocale();
  type StatsPayload = {
    builderId: number | null;
    summary: {
      userCount: string;
      builderFee: string;
      tradeCount: string;
      tradeVolume: string;
    } | null;
    daily: Array<{
      date: string;
      userCount: string;
      builderFee: string;
      tradeCount: string;
      tradeVolume: string;
    }>;
    emptyReason: string | null;
    fetchedAt?: string;
    localRelay?: { ordersRouted: number; uniqueWallets: number };
    error?: string;
  };
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/builder/fee-stats?network=mainnet&limit=90', {
        cache: 'no-store',
      });
      const json = (await res.json()) as StatsPayload;
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const empty = !summary && !(data?.daily?.length);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, letterSpacing: '-0.03em', fontSize: 'clamp(28px, 4vw, 40px)' }}>
          {t.statsTitle}
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 640, lineHeight: 1.5 }}>
          {t.statsLead}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge">FlowSentinel</span>
          <button className="btn btn-ghost" type="button" onClick={() => void load()} style={{ minHeight: 32 }}>
            Refresh
          </button>
        </div>
      </header>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading protocol stats…</p> : null}
      {error ? (
        <p role="alert" style={{ color: '#f87171' }}>
          {error}
        </p>
      ) : null}

      {data?.emptyReason ? (
        <div className="panel" style={{ padding: 18, borderColor: 'rgba(253,117,55,0.35)' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{data.emptyReason}</p>
        </div>
      ) : null}

      {!loading && empty && !data?.emptyReason ? (
        <div className="panel" style={{ padding: 18 }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t.statsEmpty}</p>
        </div>
      ) : null}

      {summary ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          {[
            { label: t.statsUsers, value: formatStatNumber(summary.userCount, { maxFrac: 0 }) },
            { label: t.statsFees, value: formatStatNumber(summary.builderFee) },
            { label: t.statsFills, value: formatStatNumber(summary.tradeCount, { maxFrac: 0 }) },
            { label: t.statsVolume, value: formatStatNumber(summary.tradeVolume) },
          ].map((card) => (
            <div key={card.label} className="panel" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{card.label}</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 22,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {data?.daily?.length ? (
        <section className="panel" style={{ padding: 18, overflowX: 'auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Daily (UTC)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Date</th>
                <th style={{ padding: '6px 8px' }}>{t.statsUsers}</th>
                <th style={{ padding: '6px 8px' }}>{t.statsFees}</th>
                <th style={{ padding: '6px 8px' }}>{t.statsFills}</th>
                <th style={{ padding: '6px 8px' }}>{t.statsVolume}</th>
              </tr>
            </thead>
            <tbody>
              {[...data.daily].reverse().slice(0, 30).map((row) => (
                <tr key={row.date} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{row.date}</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>
                    {formatStatNumber(row.userCount, { maxFrac: 0 })}
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>
                    {formatStatNumber(row.builderFee)}
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>
                    {formatStatNumber(row.tradeCount, { maxFrac: 0 })}
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>
                    {formatStatNumber(row.tradeVolume)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {data?.localRelay ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
          {t.statsLocal}: {data.localRelay.ordersRouted} orders · {data.localRelay.uniqueWallets}{' '}
          wallets.
        </p>
      ) : null}

      {data?.fetchedAt ? (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
          Updated {data.fetchedAt}
        </p>
      ) : null}
    </div>
  );
}
