'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { JarvisBriefing, JarvisIdea, SodexMarketBundle } from '@/types/flow';

const SodexPriceChart = dynamic(() => import('./SodexPriceChart').then((m) => m.SodexPriceChart), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 160 }} />,
});
const SodexDepth = dynamic(() => import('./SodexDepth').then((m) => m.SodexDepth), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 180 }} />,
});

function useTypewriter(text: string, active: boolean, cps = 42) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    setOut('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, Math.max(12, 1000 / cps));
    return () => window.clearInterval(id);
  }, [text, active, cps]);
  return out;
}

export function JarvisPanel({
  onPrefill,
}: {
  onPrefill?: (idea: JarvisIdea) => void;
}) {
  const reduce = useReducedMotion();
  const [briefing, setBriefing] = useState<JarvisBriefing | null>(null);
  const [bundle, setBundle] = useState<SodexMarketBundle | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jarvis', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Briefing failed (${res.status})`);
      const json = (await res.json()) as { briefing: JarvisBriefing };
      setBriefing(json.briefing);
      setSelected(0);
      const sym = json.briefing.ideas[0]?.symbol || 'vBTC_vUSDC';
      const m = await fetch(`/api/sodex/market?symbol=${encodeURIComponent(sym)}`, { cache: 'no-store' });
      if (m.ok) setBundle((await m.json()) as SodexMarketBundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const idea = briefing?.ideas[selected] ?? null;
  const typed = useTypewriter(briefing?.spokenSummary ?? '', Boolean(briefing) && !reduce);

  useEffect(() => {
    if (!idea) return;
    let cancelled = false;
    void (async () => {
      const m = await fetch(`/api/sodex/market?symbol=${encodeURIComponent(idea.symbol)}`, { cache: 'no-store' });
      if (!cancelled && m.ok) setBundle((await m.json()) as SodexMarketBundle);
    })();
    return () => {
      cancelled = true;
    };
  }, [idea?.symbol]);

  const mid = useMemo(() => {
    if (!bundle?.orderbook) return null;
    const bid = bundle.orderbook.bids[0]?.price;
    const ask = bundle.orderbook.asks[0]?.price;
    if (bid && ask) return (bid + ask) / 2;
    return bundle.ticker?.lastPrice ?? null;
  }, [bundle]);

  return (
    <section className="jarvis-panel glass-card" aria-label="JARVIS briefing">
      <header className="jarvis-head">
        <div>
          <p className="hero-kicker" style={{ margin: 0 }}>
            JARVIS · FlowSentinel copilot
          </p>
          <h2 style={{ margin: '6px 0 0', letterSpacing: '-0.03em' }}>
            {briefing ? `${briefing.greeting}. Here's what moved.` : 'Spinning up briefing…'}
          </h2>
        </div>
        <div className="jarvis-badges">
          <span className="pill">{briefing?.engine === 'gemini' ? 'Gemini' : 'Rules engine'}</span>
          {briefing?.newsShock ? <span className="pill pill-warn">News shock</span> : null}
          {bundle ? <span className="pill">SoDEX {bundle.gateway}</span> : null}
        </div>
      </header>

      <p className="jarvis-type" aria-live="polite">
        {loading ? 'Reading SoSoValue flows, hot news, and SoDEX books…' : typed}
        {!reduce && typed && typed.length < (briefing?.spokenSummary.length ?? 0) ? <span className="jarvis-caret">▋</span> : null}
      </p>

      {error ? <p className="error">{error}</p> : null}

      <div className="jarvis-ideas">
        {(briefing?.ideas ?? [null, null, null]).map((it, i) => (
          <motion.button
            key={it?.rank ?? `sk-${i}`}
            type="button"
            className={`jarvis-idea ${selected === i ? 'is-active' : ''}`}
            onClick={() => it && setSelected(i)}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            disabled={!it}
          >
            {it ? (
              <>
                <div className="jarvis-idea-top">
                  <span className="step-n">0{it.rank}</span>
                  <span className={`side-tag side-${it.side.toLowerCase()}`}>{it.side}</span>
                  <span className="conf">{it.confidence}%</span>
                </div>
                <strong>{it.title}</strong>
                <p>{it.reasoning}</p>
              </>
            ) : (
              <div className="skeleton" style={{ height: 88 }} />
            )}
          </motion.button>
        ))}
      </div>

      {idea ? (
        <motion.div
          className="jarvis-detail"
          key={idea.rank + idea.symbol}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="jarvis-detail-grid">
            <div>
              <h3 style={{ marginTop: 0 }}>Citations</h3>
              <ul className="jarvis-cites">
                {idea.citations.map((c, idx) => (
                  <li key={`${c.kind}-${idx}`}>
                    <span className="pill">{c.kind}</span> <strong>{c.label}</strong> — {c.detail}
                  </li>
                ))}
              </ul>
              <p>
                <strong>Risk:</strong> {idea.riskNote}
              </p>
              <p>
                <strong>Invalidation:</strong> {idea.invalidation}
              </p>
              <div className="jarvis-levels">
                <span>Entry {idea.entry.toLocaleString()}</span>
                <span>Stop {idea.stopLoss.toLocaleString()}</span>
                <span>Target {idea.takeProfit.toLocaleString()}</span>
                {mid != null ? <span>Book mid {mid.toLocaleString()}</span> : null}
              </div>
              <button type="button" className="btn btn-accent" onClick={() => onPrefill?.(idea)}>
                Prefill SoDEX ticket
              </button>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>
                {idea.symbol} · SoDEX {bundle?.gateway ?? '…'}
                {bundle?.fundingRate != null ? ` · funding ${(bundle.fundingRate * 100).toFixed(4)}%` : ''}
              </h3>
              <SodexPriceChart klines={bundle?.klines ?? []} />
              <SodexDepth book={bundle?.orderbook ?? null} />
            </div>
          </div>
        </motion.div>
      ) : null}

      <button type="button" className="btn btn-ghost" onClick={() => void load()} style={{ marginTop: 12 }}>
        Refresh briefing
      </button>
    </section>
  );
}
