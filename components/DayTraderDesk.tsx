'use client';

import { formatPair } from '@/lib/display';

import { useCallback, useEffect, useState } from 'react';
import {
  evaluateAlerts,
  loadAlerts,
  saveAlerts,
  type AlertRule,
} from '@/lib/day-trader/price-alerts';
import type { Thesis } from '@/types/flow';

type Workflow = {
  attribution: string;
  scannedAt: string;
  scan: Array<{
    symbol: string;
    setups: string[];
    labels: string[];
    price: number;
    rsi: number | null;
    gateway: string;
  }>;
  news: {
    gatewayNote: string;
    tagged: Array<{
      title: string;
      url: string;
      assets: string[];
      tags: string[];
      isShock: boolean;
    }>;
  };
  focus: {
    symbol: string;
    entry: { status: string; detail: string; side: string | null; entryPrice: number | null };
    plan: {
      entry: number;
      stop: number;
      target: number;
      risk: number;
      rewardRisk: number;
      note: string;
    } | null;
    timeMachine: {
      pTarget: number;
      pStop: number;
      pNeither: number;
      avgR: number;
      verdict: string;
      notes: string[];
      disclaimer: string;
      replays: number;
      seed: number;
    } | null;
    history: {
      sessions: number;
      triggered: number;
      target: number;
      stop: number;
      neither: number;
      avgR: number | null;
    } | null;
    size: {
      qty: number;
      notionalUsd: number;
      maxLossAtStop: number;
      limitingFactor: string;
    } | null;
    risk: {
      status: 'PASS' | 'BLOCK';
      reasons: string[];
      warnings: string[];
    } | null;
    ticket: {
      mode: 'paper';
      symbol: string;
      side: 'buy' | 'sell';
      qty: number;
      entry: number;
      stop: number;
      target: number;
      notionalUsd: number;
      builderFeeLabel: string;
    } | null;
  };
  steps: string[];
  errors: string[];
};

type Props = {
  onPrefillTicket?: (patch: Partial<Thesis> & { quantity?: number }) => void;
};

export function DayTraderDesk({ onPrefillTicket }: Props) {
  const [data, setData] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/day-trader/workflow?replays=10000&seed=19', {
        cache: 'no-store',
      });
      const json = (await res.json()) as Workflow & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setAlerts(loadAlerts());
    void run();
  }, [run]);

  // Poll last prices from desk market via thesis refresh path — lightweight ticker poll
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const tick = async () => {
      const quotes: Record<string, number> = {};
      for (const row of data.scan) {
        if (row.price > 0) quotes[row.symbol] = row.price;
      }
      if (data.focus.plan) quotes[data.focus.symbol] = data.focus.plan.entry;
      const { rules, fired } = evaluateAlerts(alerts, quotes);
      if (cancelled) return;
      if (fired.length) {
        setAlerts(rules);
        saveAlerts(rules);
        setAlertMsg(fired.map((f) => `${f.label}: ${formatPair(f.symbol)}`).join(' · '));
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            fired.forEach((f) => new Notification('FlowSentinel alert', { body: f.label }));
          }
        }
      }
    };
    const id = window.setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [alerts, data]);

  function addPlanAlerts() {
    if (!data?.focus.plan) return;
    const p = data.focus.plan;
    const sym = data.focus.symbol;
    const next: AlertRule[] = [
      ...alerts.filter((a) => !a.id.startsWith(`plan-${sym}`)),
      {
        id: `plan-${sym}-stop`,
        symbol: sym,
        kind: 'below',
        price: p.stop,
        label: `Stop ${p.stop}`,
        armed: true,
      },
      {
        id: `plan-${sym}-target`,
        symbol: sym,
        kind: 'above',
        price: p.target,
        label: `Target ${p.target}`,
        armed: true,
      },
    ];
    setAlerts(next);
    saveAlerts(next);
    setAlertMsg('Stop + target alerts armed in this browser.');
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  function prefill() {
    const t = data?.focus.ticket;
    const p = data?.focus.plan;
    if (!t || !p || !onPrefillTicket) return;
    onPrefillTicket({
      side: t.side === 'buy' ? 'LONG' : 'SHORT',
      symbol: t.symbol,
      entry: t.entry,
      stopLoss: t.stop,
      takeProfit: t.target,
      plainEnglish: `Day-trader paper ticket · ${data?.focus.timeMachine?.verdict ?? 'n/a'} · risk ${data?.focus.risk?.status}`,
      quantity: t.qty,
    });
  }

  return (
    <section className="panel" style={{ padding: 22 }} aria-label="Day trader workflow">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span className="badge" style={{ color: 'var(--accent-soft)', borderColor: 'rgba(255,79,32,0.35)' }}>
          Day Trader Desk
        </span>
        <span className="badge live">scan → news → plan → Time Machine → risk → ticket</span>
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void run()} style={{ marginLeft: 'auto' }}>
          {busy ? 'Running…' : 'Re-run workflow'}
        </button>
      </div>

      <h3 style={{ margin: '0 0 6px', letterSpacing: '-0.02em' }}>SoDEX chart skills</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 13, maxWidth: 68 * 8 }}>
        Chart skills for SoDEX + SoSoValue news. Paper by default. Prefills the confirm step only; never submits without your yes.
      </p>

      {error ? (
        <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
          {error}
        </p>
      ) : null}
      {alertMsg ? (
        <p role="status" style={{ color: 'var(--success)', fontSize: 13 }}>
          {alertMsg}
        </p>
      ) : null}

      {!data && busy ? <div className="skel" style={{ height: 160 }} /> : null}

      {data ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 12,
            }}
          >
            {data.scan.map((s) => (
              <div
                key={s.symbol}
                className="metric-chip"
                style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12 }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {formatPair(s.symbol)}
                </div>
                <div className="tabular" style={{ fontSize: 20, fontWeight: 650 }}>
                  {s.price ? `$${s.price.toLocaleString()}` : '-'}
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  {s.labels.length ? s.labels.join(' · ') : 'No daily setup'}
                  {s.rsi != null ? ` · RSI ${s.rsi}` : ''}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              News Monitor · {data.news.gatewayNote}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-muted)' }}>
              {data.news.tagged.slice(0, 5).map((n) => (
                <li key={n.url + n.title.slice(0, 12)}>
                  <a href={n.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>
                    {n.title}
                  </a>
                  {n.assets.length || n.tags.length ? (
                    <span>
                      {' '}
                      · {[...n.assets, ...n.tags].slice(0, 4).map((x) => formatPair(x) || x).join(', ')}
                    </span>
                  ) : null}
                  {n.isShock ? <span style={{ color: 'var(--accent)' }}> · shock</span> : null}
                </li>
              ))}
              {!data.news.tagged.length ? <li>No tagged headlines yet.</li> : null}
            </ul>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 12,
            }}
          >
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div className="hero-kicker">Entry · {formatPair(data.focus.symbol)}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{data.focus.entry.status}</div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {data.focus.entry.detail}
              </p>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div className="hero-kicker">Exit plan</div>
              {data.focus.plan ? (
                <div className="tabular" style={{ marginTop: 6, fontSize: 14 }}>
                  Entry {data.focus.plan.entry} · Stop {data.focus.plan.stop} · Target{' '}
                  {data.focus.plan.target}
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    Risk {data.focus.plan.risk} · R:R {data.focus.plan.rewardRisk}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No plan yet.</p>
              )}
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div className="hero-kicker">Time Machine · simulation</div>
              {data.focus.timeMachine ? (
                <>
                  <div style={{ fontWeight: 650, marginTop: 4 }}>{data.focus.timeMachine.verdict}</div>
                  <div className="tabular" style={{ fontSize: 13, marginTop: 6 }}>
                    Target-first {(data.focus.timeMachine.pTarget * 100).toFixed(1)}% · Stop-first{' '}
                    {(data.focus.timeMachine.pStop * 100).toFixed(1)}% · Neither{' '}
                    {(data.focus.timeMachine.pNeither * 100).toFixed(1)}% · avg R{' '}
                    {data.focus.timeMachine.avgR}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                    {data.focus.timeMachine.disclaimer}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not enough session history yet.</p>
              )}
              {data.focus.history ? (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Past ORB: {data.focus.history.triggered}/{data.focus.history.sessions} fired ·{' '}
                  {data.focus.history.target} target · {data.focus.history.stop} stop · avg R{' '}
                  {data.focus.history.avgR ?? '-'}
                </p>
              ) : null}
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(255,118,55,0.35)',
              borderRadius: 14,
              padding: 16,
              background: 'rgba(255,79,32,0.05)',
            }}
          >
            <div className="hero-kicker">Risk · budget · paper ticket</div>
            {data.focus.size && data.focus.risk ? (
              <>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Size {data.focus.size.qty} · notional ${data.focus.size.notionalUsd} · max loss $
                  {data.focus.size.maxLossAtStop} ({data.focus.size.limitingFactor})
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontWeight: 650,
                    color: data.focus.risk.status === 'PASS' ? 'var(--success)' : '#f87171',
                  }}
                >
                  Risk {data.focus.risk.status}
                </div>
                {data.focus.risk.reasons.map((r) => (
                  <div key={r} style={{ fontSize: 12, color: '#f87171' }}>
                    {r}
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ticket not ready.</p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={!data.focus.ticket || data.focus.risk?.status !== 'PASS'}
                onClick={prefill}
              >
                Prefill Builder confirm (paper)
              </button>
              <button className="btn btn-ghost" type="button" disabled={!data.focus.plan} onClick={addPlanAlerts}>
                Arm browser stop/target alerts
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              SoSoValue/SoDEX colours · FlowSentinel never auto-submits.
            </p>
          </div>

          {data.errors.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)' }}>
              {data.errors.map((e) => (
                <li key={e.slice(0, 40)}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
