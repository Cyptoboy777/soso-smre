'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LiveBadge } from '@/components/LiveBadge';
import { CountUp } from '@/components/CountUp';
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
  const reduce = useReducedMotion();
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

  const hit = data?.stats.hitRate ?? 0;

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <header>
        <p className="hero-kicker">Results</p>
        <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.9rem, 4vw, 2.7rem)', letterSpacing: '-0.04em' }}>
          Public track record
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 560, textWrap: 'pretty' }}>
          Every idea is logged. Outcomes use real market prices. We never invent results.
        </p>
      </header>

      {error && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {!data && !error && <div className="skel" style={{ height: 200 }} />}

      {data && (
        <>
          <section
            className="panel"
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: 28,
                borderRight: '1px solid var(--line)',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,79,32,0.04)',
              }}
            >
              <div
                className="hit-ring"
                style={{ ['--pct' as string]: data.stats.hitRate == null ? 0 : hit }}
                aria-label={data.stats.hitRate == null ? 'No hit rate yet' : `Hit rate ${hit}%`}
              >
                <div style={{ textAlign: 'center' }}>
                  <div className="tabular" style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.03em' }}>
                    {data.stats.hitRate == null ? '-' : <CountUp value={hit} decimals={0} suffix="%" />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hit rate</div>
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))',
              }}
            >
              <Stat label="Ideas" value={data.stats.total} />
              <Stat label="Resolved" value={data.stats.resolved} />
              <Stat label="Wins" value={data.stats.wins} tone="up" />
              <Stat label="Losses" value={data.stats.losses} tone="down" />
            </div>
          </section>

          {/* Outcome timeline */}
          <section className="panel">
            <div className="panel-head">
              <strong style={{ fontWeight: 560 }}>Outcome timeline</strong>
              <LiveBadge source={data.marksSource.source} note={data.marksSource.note} />
            </div>
            <div className="panel-body">
              {data.entries.length === 0 ? (
                <div className="empty-state">
                  <strong>No ideas logged yet</strong>
                  <span>Generate a thesis on the Desk to start the public record.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {data.entries.slice(0, 24).map((e, i) => {
                    const color =
                      e.outcome === 'hit_tp'
                        ? 'var(--success)'
                        : e.outcome === 'hit_sl'
                          ? 'var(--danger)'
                          : e.outcome === 'open'
                            ? 'var(--accent-soft)'
                            : 'var(--text-faint)';
                    return (
                      <motion.div
                        key={e.id}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35 }}
                        title={`${sideLabel(e.side)} ${e.symbol} · ${outcomeLabel(e.outcome)}`}
                        style={{
                          minWidth: 56,
                          padding: '10px 8px',
                          borderRadius: 12,
                          border: `1px solid ${color}`,
                          background: 'rgba(255,255,255,0.02)',
                          textAlign: 'center',
                          fontSize: 11,
                        }}
                      >
                        <div style={{ color, fontWeight: 600, marginBottom: 4 }}>{sideLabel(e.side)[0]}</div>
                        <div className="tabular" style={{ color: 'var(--text-muted)' }}>
                          {e.pnlPct == null ? '-' : `${e.pnlPct > 0 ? '+' : ''}${e.pnlPct.toFixed(1)}%`}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

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
                  {['When (IST)', 'Direction', 'Symbol', 'Entry', 'Conf.', 'Mode', 'Outcome', 'PnL %', 'Proof'].map((h) => (
                    <th
                      key={h}
                      style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', fontWeight: 500 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.entries.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 28, color: 'var(--text-muted)' }}>
                      Empty record. The Desk will append ideas here.
                    </td>
                  </tr>
                )}
                {data.entries.map((e) => (
                  <tr key={e.id} style={{ transition: 'background 150ms' }}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                      {new Date(e.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>{sideLabel(e.side)}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>{e.symbol}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                      ${e.entry.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>{e.confidence}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>{modeLabel(e.orderMode)}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>{outcomeLabel(e.outcome)}</td>
                    <td
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--line)',
                        color:
                          e.pnlPct == null
                            ? 'var(--text-muted)'
                            : e.pnlPct >= 0
                              ? 'var(--success)'
                              : 'var(--danger)',
                      }}
                    >
                      {e.pnlPct == null ? '-' : `${e.pnlPct >= 0 ? '+' : ''}${e.pnlPct}%`}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                      {proofHref(e.orderId) ? (
                        <a
                          href={proofHref(e.orderId)!}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                        >
                          Order {e.orderId}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>-</span>
                      )}
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


function sideLabel(side: string) {
  if (side === 'LONG') return 'Bullish';
  if (side === 'SHORT') return 'Bearish';
  return 'Neutral';
}

function modeLabel(mode: string) {
  if (mode === 'live') return 'Submitted';
  if (mode === 'dry-run') return 'Not submitted';
  return 'Idea only';
}

function outcomeLabel(o: string) {
  const map: Record<string, string> = {
    open: 'Open',
    hit_tp: 'Target hit',
    hit_sl: 'Stop hit',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };
  return map[o] ?? o;
}

function proofHref(orderId?: string) {
  if (!orderId || orderId.startsWith('dry-') || orderId.startsWith('err-') || orderId.startsWith('blocked-')) {
    return null;
  }
  // Public SoDEX docs / gateway reference; link presents the order id for verification
  return `https://sodex.com/documentation/for-developers/developers/trading/authentication-and-signing?orderId=${encodeURIComponent(orderId)}`;
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'up' | 'down' }) {
  return (
    <div style={{ padding: 22, borderRight: '1px solid var(--line)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div
        className="tabular"
        style={{
          fontSize: 26,
          fontWeight: 650,
          letterSpacing: '-0.03em',
          color: tone === 'up' ? 'var(--success)' : tone === 'down' ? 'var(--danger)' : 'var(--text)',
        }}
      >
        <CountUp value={value} />
      </div>
    </div>
  );
}
