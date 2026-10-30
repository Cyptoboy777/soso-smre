'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { DeskSnapshot, OrderResult, RiskDecision, SourceMeta } from '@/types/flow';
import { LiveBadge } from './LiveBadge';
import { FlowRadar } from './FlowRadar';
import { CountUp } from './CountUp';
import { VoiceAssistant } from './VoiceAssistant';

type DeskPayload = DeskSnapshot & {
  keys: { sosovalue: boolean; gemini: boolean; sodex: boolean };
  trackId?: string;
};

function fmtUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return null;
  return n;
}

function fmtPctFraction(n: number | null) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i * 0.05, 0.3),
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

export function DeskClient() {
  const reduce = useReducedMotion();
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
      setData((await res.json()) as DeskPayload);
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
        <div className="skel" style={{ height: 240 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          <div className="skel" style={{ height: 160 }} />
          <div className="skel" style={{ height: 160 }} />
          <div className="skel" style={{ height: 160 }} />
          <div className="skel" style={{ height: 160 }} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel" style={{ padding: 28 }}>
        <p className="hero-kicker">Desk offline</p>
        <h2 style={{ margin: '0 0 8px', letterSpacing: '-0.03em' }}>Could not load today&apos;s thesis</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => void load()}>
          Retry desk
        </button>
      </div>
    );
  }

  if (!data) return null;
  const { thesis, risk, etfBtc, etfEth, news, ssi, market, keys } = data;
  const btcFlow = fmtUsd(etfBtc.latest?.totalNetInflow);
  const ethFlow = fmtUsd(etfEth.latest?.totalNetInflow);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="desk-intro">
        <div>
          <p className="hero-kicker">One-person fund desk</p>
          <h1>Today&apos;s insight → confirmed action</h1>
          <p>
            SoSoValue flows and news become a plain-English thesis, a risk gate, and a confirmed SoDEX
            testnet order. Fallback panels are always labelled.
          </p>
        </div>
      </div>

      {/* Hero */}
      <motion.section
        className="panel desk-hero"
        variants={reduce ? undefined : fadeUp}
        initial={reduce ? false : 'hidden'}
        animate="show"
        custom={0}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.45fr) minmax(220px,0.55fr)',
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
            <span className={`badge ${thesis.side === 'FLAT' ? 'fallback' : 'live'}`}>{thesis.side}</span>
          </div>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 'clamp(1.7rem, 3.6vw, 2.5rem)',
              letterSpacing: '-0.04em',
              lineHeight: 1.12,
              textWrap: 'balance',
              fontWeight: 650,
            }}
          >
            {thesis.side === 'FLAT'
              ? 'Stand aside today'
              : `${thesis.side} ${thesis.symbol.replace(/v/g, '').replace('_', '/')}`}
          </h2>
          <p style={{ margin: '0 0 22px', color: 'var(--text-muted)', maxWidth: 54 * 8, textWrap: 'pretty' }}>
            {thesis.plainEnglish}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div className="metric-chip">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Confidence</div>
              <div style={{ color: 'var(--accent)', fontSize: 26, fontWeight: 650, letterSpacing: '-0.03em' }}>
                <CountUp value={thesis.confidence} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}> /100</span>
              </div>
            </div>
            <MetricChip label="Entry" value={thesis.entry} prefix="$" />
            <MetricChip label="Stop" value={thesis.stopLoss} prefix="$" />
            <MetricChip label="Target" value={thesis.takeProfit} prefix="$" />
            <div className="metric-chip">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Horizon</div>
              <div className="tabular" style={{ fontSize: 18, fontWeight: 600 }}>
                {thesis.horizonHours}h
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            background: 'linear-gradient(165deg, rgba(127,39,17,0.42), rgba(10,10,10,0.15))',
            borderLeft: '1px solid var(--line)',
            display: 'grid',
            placeItems: 'center',
            padding: 22,
          }}
        >
          <FlowRadar
            btcInflow={etfBtc.latest?.totalNetInflow ?? null}
            ethInflow={etfEth.latest?.totalNetInflow ?? null}
          />
        </div>
      </motion.section>

      {/* Data panels */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
        }}
      >
        <DataCard title="BTC US ETF flow" meta={etfBtc.meta} index={1}>
          {btcFlow == null ? (
            <EmptyPanel
              title="No ETF print yet"
              body="When SOSOVALUE_API_KEY is set, the latest US BTC ETF net inflow appears here."
            />
          ) : (
            <>
              <BigFlow value={btcFlow} hint={`Latest ${etfBtc.latest?.date ?? '—'}`} />
              <MiniBars history={etfBtc.history.slice(0, 7).reverse()} />
            </>
          )}
        </DataCard>
        <DataCard title="ETH US ETF flow" meta={etfEth.meta} index={2}>
          {ethFlow == null ? (
            <EmptyPanel
              title="No ETF print yet"
              body="ETH US ETF net inflow/outflow will show live with a SoSoValue key."
            />
          ) : (
            <>
              <BigFlow value={ethFlow} hint={`Latest ${etfEth.latest?.date ?? '—'}`} />
              <MiniBars history={etfEth.history.slice(0, 7).reverse()} />
            </>
          )}
        </DataCard>
        <DataCard title="ssiMAG7" meta={ssi.meta} index={3}>
          {ssi.price == null ? (
            <EmptyPanel title="SSI unavailable" body="Index snapshot needs SOSOVALUE_API_KEY or will show labelled fallback." />
          ) : (
            <>
              <div className="tabular" style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.03em' }}>
                <CountUp value={ssi.price} decimals={2} />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                24h {fmtPctFraction(ssi.changePct24h)} · 7d {fmtPctFraction(ssi.roi7d)}
              </p>
            </>
          )}
        </DataCard>
        <DataCard title="Hot news" meta={news.meta} index={4}>
          {news.items.length === 0 ? (
            <EmptyPanel title="No headlines" body="Hot news fills in from SoSoValue /news/hot when the key is present." />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {news.items.slice(0, 3).map((n) => (
                <li key={n.id} style={{ fontSize: 13, lineHeight: 1.4 }}>
                  <a className="news-link" href={n.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>
                    {n.isShock ? '⚠ ' : ''}
                    {n.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {news.shockActive && (
            <p style={{ margin: '12px 0 0', color: 'var(--danger)', fontSize: 12 }}>News-shock pause armed</p>
          )}
        </DataCard>
      </section>

      {/* Market */}
      <motion.section
        className="panel"
        variants={reduce ? undefined : fadeUp}
        initial={reduce ? false : 'hidden'}
        animate="show"
        custom={5}
      >
        <div className="panel-head">
          <strong style={{ fontWeight: 560 }}>SoDEX market</strong>
          <LiveBadge source={market.meta.source} note={market.meta.note} />
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
          {market.tickers.length === 0 ? (
            <EmptyPanel title="No tickers" body="Public SoDEX tickers will appear when the gateway responds." />
          ) : (
            market.tickers.slice(0, 4).map((t) => (
              <div key={t.symbol}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{t.symbol}</div>
                <div className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>
                  $<CountUp value={t.lastPrice} decimals={t.lastPrice >= 100 ? 0 : 2} />{' '}
                  <span style={{ color: t.changePct24h >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {t.changePct24h >= 0 ? '+' : ''}
                    {t.changePct24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.section>

      {/* Risk + confirm */}
      <motion.section
        className="panel risk-split"
        variants={reduce ? undefined : fadeUp}
        initial={reduce ? false : 'hidden'}
        animate="show"
        custom={6}
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
            {risk.checks.map((c, i) => (
              <motion.div
                key={c.id}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 10, fontSize: 14 }}
              >
                <span aria-hidden style={{ color: c.passed ? 'var(--success)' : 'var(--danger)' }}>
                  {c.passed ? '✓' : '×'}
                </span>
                <div>
                  <div style={{ fontWeight: 550 }}>{c.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.detail}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--line)', padding: 24, background: 'rgba(255,79,32,0.035)' }}>
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
          <p style={{ margin: '14px 0 0', fontSize: 11, color: 'var(--text-faint)' }}>
            Voice assistant never places orders — confirmation click required.
          </p>
        </div>
      </motion.section>

      <VoiceAssistant desk={data} onRefresh={() => void load()} />

      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
        Keys: SoSoValue {keys.sosovalue ? '✓' : '✗'} · Gemini {keys.gemini ? '✓' : '✗'} · SoDEX{' '}
        {keys.sodex ? '✓' : '✗'} · Demo mode {data.demoMode ? 'on' : 'off'}
      </p>
    </div>
  );
}

function MetricChip({ label, value, prefix = '' }: { label: string; value: number; prefix?: string }) {
  const decimals = value >= 1000 ? 0 : value >= 1 ? 2 : 4;
  return (
    <div className="metric-chip">
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
        <CountUp value={value} decimals={decimals} prefix={prefix} />
      </div>
    </div>
  );
}

function DataCard({
  title,
  meta,
  children,
  index,
}: {
  title: string;
  meta: SourceMeta;
  children: React.ReactNode;
  index: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      className="panel panel-interactive"
      variants={reduce ? undefined : fadeUp}
      initial={reduce ? false : 'hidden'}
      animate="show"
      custom={index}
    >
      <div className="panel-head">
        <strong style={{ fontWeight: 560, fontSize: 14 }}>{title}</strong>
        <LiveBadge source={meta.source} note={meta.note} />
      </div>
      <div className="panel-body">{children}</div>
    </motion.article>
  );
}

function BigFlow({ value, hint }: { value: number; hint?: string }) {
  const abs = Math.abs(value);
  let scaled = abs;
  let suffix = '';
  if (abs >= 1e9) {
    scaled = abs / 1e9;
    suffix = 'B';
  } else if (abs >= 1e6) {
    scaled = abs / 1e6;
    suffix = 'M';
  } else if (abs >= 1e3) {
    scaled = abs / 1e3;
    suffix = 'K';
  }
  return (
    <div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 650,
          letterSpacing: '-0.03em',
          color: value >= 0 ? 'var(--success)' : 'var(--danger)',
        }}
      >
        <CountUp value={scaled} decimals={suffix === 'B' ? 2 : 1} prefix={value < 0 ? '−$' : '+$'} suffix={suffix} />
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
              transition: 'height 400ms var(--ease-out)',
            }}
          />
        );
      })}
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
