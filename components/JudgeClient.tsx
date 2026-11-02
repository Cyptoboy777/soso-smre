'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { Activity, CheckCircle2, ShieldAlert, Newspaper, LineChart, FileCheck2 } from 'lucide-react';
import type { DeskSnapshot, OrderResult, RiskDecision } from '@/types/flow';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { id: 0, label: 'Pull SoSoValue', icon: Activity },
  { id: 1, label: 'Thesis', icon: Newspaper },
  { id: 2, label: 'Risk gate', icon: ShieldAlert },
  { id: 3, label: 'Confirm ticket', icon: FileCheck2 },
  { id: 4, label: 'Submit', icon: LineChart },
  { id: 5, label: 'Receipt', icon: CheckCircle2 },
] as const;

type DeskPayload = DeskSnapshot & {
  keys: { sosovalue: boolean; gemini: boolean; sodex: boolean };
};

export function JudgeClient() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  const [desk, setDesk] = useState<DeskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [queried, setQueried] = useState<{ status?: string } | null>(null);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/thesis?persist=1', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Desk ${res.status}`);
        const json = (await res.json()) as DeskPayload;
        if (!cancelled) {
          setDesk(json);
          setStep(1);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auto || !desk) return;
    if (step === 1) {
      const t = setTimeout(() => setStep(2), 2200);
      return () => clearTimeout(t);
    }
    if (step === 2) {
      const t = setTimeout(() => setStep(3), 2200);
      return () => clearTimeout(t);
    }
  }, [auto, desk, step]);

  async function submit() {
    if (!desk || !confirming) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thesis: desk.thesis,
          news: desk.news,
          confirmed: true,
          quantity: desk.risk.positionSize,
        }),
      });
      const json = (await res.json()) as {
        order?: OrderResult;
        error?: string;
        risk?: RiskDecision;
        queried?: { status?: string };
        modeLabel?: string;
      };
      if (!res.ok) {
        setError(json.error || 'Blocked');
        if (json.risk) setDesk({ ...desk, risk: json.risk });
        return;
      }
      if (json.order) setOrder(json.order);
      setQueried(json.queried ?? null);
      setStep(5);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const modeLabel = useMemo(() => {
    if (!desk) return '…';
    if (order) return order.mode === 'live' ? 'TESTNET LIVE (EIP-712)' : 'DRY-RUN SIMULATED';
    return desk.keys.sodex ? 'TESTNET READY' : 'DRY-RUN (no trade keys)';
  }, [desk, order]);

  return (
    <main className="judge-page">
      <header className="judge-top">
        <div>
          <p className="eyebrow">Judge path · 60 seconds</p>
          <h1>Data → thesis → risk → confirm → receipt</h1>
          <p className="lede">
            Same loop as the live desk. SoSoValue drives the call. Orders stay SoDEX testnet only, never mainnet.
          </p>
        </div>
        <div className="judge-top-actions">
          <span className={`mode-pill ${order?.mode === 'live' ? 'live' : 'sim'}`}>{modeLabel}</span>
          <label className="judge-auto">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto-advance
          </label>
          <Link href="/" className="btn btn-ghost">
            Full desk
          </Link>
        </div>
      </header>

      <ol className="judge-steps" aria-label="Judge steps">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <li key={s.id} className={`judge-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}>
              <Icon size={16} strokeWidth={1.75} aria-hidden />
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {error ? <p className="error">{error}</p> : null}

      <section className="judge-stage glass-card">
        {step === 0 && <p className="muted">Pulling ETF flows, hot news, SSI, and SoDEX marks…</p>}

        {desk && step >= 1 && (
          <motion.div
            key={`s-${step}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 1 && (
              <>
                <h2>Thesis · {desk.thesis.engine === 'gemini' ? 'Gemini' : 'Rules'}</h2>
                <p className="judge-thesis">
                  <strong>{desk.thesis.side}</strong> {desk.thesis.symbol} · confidence {desk.thesis.confidence}
                </p>
                <p>{desk.thesis.plainEnglish}</p>
                <ul className="judge-cites">
                  <li>BTC ETF net: {desk.etfBtc.latest?.totalNetInflow ?? 'n/a'} ({desk.etfBtc.meta.source})</li>
                  <li>ETH ETF net: {desk.etfEth.latest?.totalNetInflow ?? 'n/a'} ({desk.etfEth.meta.source})</li>
                  <li>
                    ssiMAG7: {desk.ssi.price ?? 'n/a'} / 24h{' '}
                    {desk.ssi.changePct24h != null ? `${(desk.ssi.changePct24h * 100).toFixed(2)}%` : 'n/a'} (
                    {desk.ssi.meta.source})
                  </li>
                  {desk.news.items.slice(0, 3).map((n) => (
                    <li key={n.id}>
                      News [{n.id}]: {n.title}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-accent" onClick={() => setStep(2)}>
                  Continue to risk
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h2>Risk gate</h2>
                <p>
                  {desk.risk.approved ? 'Approved' : 'Blocked'} · size {desk.risk.positionSize} · notional $
                  {desk.risk.notionalUsd.toFixed(0)} · risk {desk.risk.riskPct.toFixed(2)}%
                </p>
                <ul className="judge-checks">
                  {desk.risk.checks.map((c) => (
                    <li key={c.id} className={c.passed ? 'ok' : 'fail'}>
                      {c.passed ? 'Pass' : 'Fail'} · {c.label}: {c.detail}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-accent" onClick={() => setStep(3)} disabled={!desk.risk.approved && desk.thesis.side !== 'FLAT'}>
                  {desk.risk.approved ? 'Continue to confirm' : desk.thesis.side === 'FLAT' ? 'FLAT · still show ticket' : 'Blocked'}
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <h2>Confirm ticket</h2>
                <div className="judge-ticket tabular">
                  <div>Side</div>
                  <div>{desk.thesis.side === 'SHORT' ? 'SELL' : desk.thesis.side === 'LONG' ? 'BUY' : '-'}</div>
                  <div>Symbol</div>
                  <div>{desk.thesis.symbol}</div>
                  <div>Entry</div>
                  <div>{desk.thesis.entry.toLocaleString()}</div>
                  <div>Stop</div>
                  <div>{desk.thesis.stopLoss.toLocaleString()}</div>
                  <div>Target</div>
                  <div>{desk.thesis.takeProfit.toLocaleString()}</div>
                  <div>Qty</div>
                  <div>{desk.risk.positionSize}</div>
                </div>
                <label className="judge-confirm">
                  <input type="checkbox" checked={confirming} onChange={(e) => setConfirming(e.target.checked)} />
                  I confirm this SoDEX <strong>testnet</strong> ticket. Voice never places orders.
                </label>
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={!confirming || busy || desk.thesis.side === 'FLAT' || !desk.risk.approved}
                  onClick={() => {
                    setStep(4);
                    void submit();
                  }}
                >
                  Submit on testnet
                </button>
              </>
            )}

            {(step === 4 || step === 5) && (
              <>
                <h2>{step === 4 ? 'Submitting…' : 'Receipt'}</h2>
                {order ? (
                  <div className="judge-receipt">
                    <p>
                      <span className={`mode-pill ${order.mode === 'live' ? 'live' : 'sim'}`}>
                        {order.mode === 'live' ? 'TESTNET LIVE' : 'DRY-RUN SIMULATED'}
                      </span>
                    </p>
                    <p className="tabular">
                      Order ID: <strong>{order.orderId}</strong>
                    </p>
                    <p>
                      Status: {order.status}
                      {queried?.status ? ` · queried ${queried.status}` : ''}
                    </p>
                    <p className="muted">{order.note}</p>
                    <Link href="/track-record" className="btn btn-ghost">
                      Open track record
                    </Link>
                  </div>
                ) : (
                  <p className="muted">{busy ? 'Waiting for SoDEX…' : 'No order yet.'}</p>
                )}
              </>
            )}
          </motion.div>
        )}
      </section>
    </main>
  );
}
