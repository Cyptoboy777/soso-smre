'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DeskSnapshot, OrderResult, RiskDecision } from '@/types/flow';
import { LiveBadge } from './LiveBadge';
import { FlowRadar } from './FlowRadar';

type DeskPayload = DeskSnapshot & {
  keys: { sosovalue: boolean; gemini: boolean; sodex: boolean };
  trackId?: string;
};

function fmtUsd(n: number | null | undefined, compact = true) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (!compact) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPctFraction(n: number | null) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}

export function DeskClient() {
  const [data, setData] = useState<DeskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOrder(null);
    setConfirming(false);
    try {
      const res = await fetch('/api/thesis?persist=1', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Desk load failed (${res.status})`);
      const json = (await res.json()) as DeskPayload;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function execute() {
    if (!data || !confirming) return;
    setBusy(true);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thesis: data.thesis,
          news: data.news,
          confirmed: true,
          quantity: data.risk.positionSize,
        }),
      });
      const json = (await res.json()) as { order?: OrderResult; error?: string; risk?: RiskDecision };
      if (!res.ok) {
        setError(json.error ?? 'Order blocked');
        if (json.risk) setData({ ...data, risk: json.risk });
        return;
      }
      if (json.order) setOrder(json.order);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="skel" style={{ height: 220 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          <div className="skel" style={{ height: 160 }} />
          <div className="skel" style={{ height: 160 }} />
          <div className="skel" style={{ height: 160 }} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        <p style={{ margin: 0 }}>{error}</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;
  const { thesis, risk, etfBtc, etfEth, news, ssi, market, keys } = data;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Hero */}
      <section
        className="panel rise desk-hero"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.4fr) minmax(200px,0.6fr)',
          gap: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <span className="badge" style={{ color: 'var(--accent-soft)', borderColor: 'rgba(255,79,32,0.35)' }}>
              Daily thesis
            </span>
            <span className="badge">{thesis.engine === 'gemini' ? 'Gemini' : 'Rules engine'}</span>
            <span className="badge">{thesis.side}</span>
          </div>
          <h1
            style={{
              margin: '0 0 12px',
              fontSize: 'clamp(1.6rem, 3.5vw, 2.35rem)',
              letterSpacing: '-0.035em',
              lineHeight: 1.15,
              textWrap: 'balance',
              fontWeight: 600,
            }}
          >
            {thesis.side === 'FLAT' ? 'Stand aside today' : `${thesis.side} ${thesis.symbol.replace(/v/g, '').replace('_', '/')}`}
          </h1>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', maxWidth: 58 * 8, textWrap: 'pretty' }}>
            {thesis.plainEnglish}
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'end' }}>
            <Metric label="Confidence" value={`${thesis.confidence}`} suffix="/100" accent />
            <Metric label="Entry" value={`$${thesis.entry.toLocaleString()}`} />
            <Metric label="Stop" value={`$${thesis.stopLoss.toLocaleString()}`} />
            <Metric label="Target" value={`$${thesis.takeProfit.toLocaleString()}`} />
            <Metric label="Horizon" value={`${thesis.horizonHours}h`} />
          </div>
        </div>
        <div
          style={{
            background: 'linear-gradient(160deg, rgba(127,39,17,0.35), rgba(10,10,10,0.2))',
            borderLeft: '1px solid var(--line)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <FlowRadar
            btcInflow={etfBtc.latest?.totalNetInflow ?? null}
            ethInflow={etfEth.latest?.totalNetInflow ?? null}
          />
        </div>
      </section>

      {/* Data panels */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <DataCard title="BTC US ETF flow" meta={etfBtc.meta} className="rise rise-d1">
          <BigStat
            value={fmtUsd(etfBtc.latest?.totalNetInflow)}
            hint={`Latest ${etfBtc.latest?.date ?? '—'}`}
            tone={(etfBtc.latest?.totalNetInflow ?? 0) >= 0 ? 'up' : 'down'}
          />
          <MiniBars history={etfBtc.history.slice(0, 7).reverse()} />
        </DataCard>
        <DataCard title="ETH US ETF flow" meta={etfEth.meta} className="rise rise-d2">
          <BigStat
            value={fmtUsd(etfEth.latest?.totalNetInflow)}
            hint={`Latest ${etfEth.latest?.date ?? '—'}`}
            tone={(etfEth.latest?.totalNetInflow ?? 0) >= 0 ? 'up' : 'down'}
          />
          <MiniBars history={etfEth.history.slice(0, 7).reverse()} />
        </DataCard>
        <DataCard title="ssiMAG7" meta={ssi.meta} className="rise rise-d3">
          <BigStat value={ssi.price?.toFixed(2) ?? '—'} hint={`24h ${fmtPctFraction(ssi.changePct24h)}`} />
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            7d ROI {fmtPctFraction(ssi.roi7d)}
          </p>
        </DataCard>
        <DataCard title="Hot news" meta={news.meta} className="rise rise-d4">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {news.items.slice(0, 3).map((n) => (
              <li key={n.id} style={{ fontSize: 13, lineHeight: 1.4 }}>
                <a href={n.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>
                  {n.isShock ? '⚠ ' : ''}
                  {n.title}
                </a>
              </li>
            ))}
          </ul>
          {news.shockActive && (
            <p style={{ margin: '12px 0 0', color: 'var(--danger)', fontSize: 12 }}>News-shock pause armed</p>
          )}
        </DataCard>
      </section>

      {/* Market strip */}
      <section className="panel rise rise-d2">
        <div className="panel-head">
          <strong style={{ fontWeight: 560 }}>SoDEX market</strong>
          <LiveBadge source={market.meta.source} note={market.meta.note} />
        </div>
        <div
          className="panel-body"
          style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 13 }}
        >
          {market.tickers.slice(0, 4).map((t) => (
            <div key={t.symbol}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{t.symbol}</div>
              <div className="tabular">
                ${t.lastPrice.toLocaleString()}{' '}
                <span style={{ color: t.changePct24h >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {t.changePct24h >= 0 ? '+' : ''}
                  {t.changePct24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Risk gate + confirm */}
      <section
        className="panel rise rise-d3 risk-split"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,0.55fr)' }}
      >
        <div>
          <div className="panel-head">
            <strong style={{ fontWeight: 560 }}>Risk gate</strong>
            <span className={`badge ${risk.approved ? 'live' : 'unavailable'}`}>
              <span className="dot" />
              {risk.approved ? 'Pass' : 'Blocked'}
            </span>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 10 }}>
            {risk.checks.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr',
                  gap: 10,
                  alignItems: 'start',
                  fontSize: 14,
                }}
              >
                <span aria-hidden style={{ color: c.passed ? 'var(--success)' : 'var(--danger)' }}>
                  {c.passed ? '✓' : '×'}
                </span>
                <div>
                  <div style={{ fontWeight: 550 }}>{c.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--line)', padding: 24, background: 'rgba(255,79,32,0.03)' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, letterSpacing: '-0.02em' }}>Confirm & execute</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
            Limit {thesis.side === 'SHORT' ? 'SELL' : 'BUY'} {risk.positionSize || '—'} {thesis.symbol} @ $
            {thesis.entry.toLocaleString()}
            <br />
            Risk ${risk.riskUsd} ({risk.riskPct}% of ${risk.equityUsd.toLocaleString()} equity)
          </p>

          {!keys.sodex && (
            <p className="badge fallback" style={{ marginBottom: 12, display: 'inline-flex' }}>
              SoDEX keys absent → dry-run only
            </p>
          )}

          <label
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              marginBottom: 14,
              fontSize: 14,
              cursor: risk.approved ? 'pointer' : 'not-allowed',
              opacity: risk.approved ? 1 : 0.5,
            }}
          >
            <input
              type="checkbox"
              checked={confirming}
              disabled={!risk.approved || busy}
              onChange={(e) => setConfirming(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--accent)' }}
            />
            <span>I reviewed the thesis and risk checks. Place the SoDEX testnet limit order.</span>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              disabled={!risk.approved || !confirming || busy || thesis.side === 'FLAT'}
              onClick={() => void execute()}
            >
              {busy ? 'Submitting…' : keys.sodex ? 'Place testnet order' : 'Run dry-run order'}
            </button>
            <button className="btn" onClick={() => void load()} disabled={busy}>
              Refresh thesis
            </button>
          </div>

          {order && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 560, marginBottom: 4 }}>
                {order.mode === 'dry-run' ? 'Dry-run result' : 'Order result'} · {order.status}
              </div>
              <div className="tabular">ID {order.orderId}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>{order.note}</div>
            </div>
          )}
          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }} role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* Key status */}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
        Keys: SoSoValue {keys.sosovalue ? '✓' : '✗'} · Gemini {keys.gemini ? '✓' : '✗'} · SoDEX{' '}
        {keys.sodex ? '✓' : '✗'} · Demo mode {data.demoMode ? 'on' : 'off'}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div
        className="tabular"
        style={{
          fontSize: accent ? 28 : 18,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {value}
        {suffix && <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}> {suffix}</span>}
      </div>
    </div>
  );
}

function DataCard({
  title,
  meta,
  children,
  className = '',
}: {
  title: string;
  meta: { source: 'live' | 'fallback' | 'unavailable'; note?: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`panel ${className}`}>
      <div className="panel-head">
        <strong style={{ fontWeight: 560, fontSize: 14 }}>{title}</strong>
        <LiveBadge source={meta.source} note={meta.note} />
      </div>
      <div className="panel-body">{children}</div>
    </article>
  );
}

function BigStat({
  value,
  hint,
  tone,
}: {
  value: string;
  hint?: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div>
      <div
        className="tabular"
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: tone === 'up' ? 'var(--success)' : tone === 'down' ? 'var(--danger)' : 'var(--text)',
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function MiniBars({ history }: { history: { totalNetInflow: number }[] }) {
  if (!history.length) return null;
  const max = Math.max(...history.map((h) => Math.abs(h.totalNetInflow)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 36, marginTop: 14 }} aria-hidden>
      {history.map((h, i) => {
        const hgt = Math.max(4, (Math.abs(h.totalNetInflow) / max) * 36);
        const up = h.totalNetInflow >= 0;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: hgt,
              borderRadius: 3,
              background: up ? 'rgba(30,168,88,0.7)' : 'rgba(242,66,55,0.7)',
            }}
          />
        );
      })}
    </div>
  );
}

