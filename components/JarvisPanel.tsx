'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { JarvisBriefing, JarvisIdea, SodexMarketBundle } from '@/types/flow';
import { validateAdvisorSuggestion } from '@/lib/advisor-suggestions';
import { PairSelector } from './PairSelector';
import { LivePrice } from './LivePrice';

function directionLabel(side: string) {
  if (side === 'LONG') return 'Bullish';
  if (side === 'SHORT') return 'Bearish';
  return 'Neutral';
}


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
  const [symbol, setSymbol] = useState('vBTC_vUSDC');
  const [interval, setIntervalTf] = useState('1h');

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
    if (idea?.symbol && idea.symbol !== symbol) setSymbol(idea.symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.symbol]);

  useEffect(() => {
    let cancelled = false;
    const loadMarket = async () => {
      try {
        const m = await fetch(
          `/api/sodex/market?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`,
          { cache: 'no-store' },
        );
        if (!cancelled && m.ok) setBundle((await m.json()) as SodexMarketBundle);
      } catch {
        /* ignore */
      }
    };
    void loadMarket();
    const id = window.setInterval(loadMarket, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol, interval]);

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
            Desk briefing
          </p>
          <h2 style={{ margin: '6px 0 0', letterSpacing: '-0.03em' }}>
            {briefing ? (
              `${briefing.greeting}. Here is what moved.`
            ) : (
              <span className="briefing-skel" aria-busy="true" aria-label="Loading briefing">
                <span className="skel-line skel-line-lg" />
              </span>
            )}
          </h2>
        </div>
        <div className="jarvis-badges">
          <span className="pill">Live prices</span>
          <span className="pill">Practice mode</span>
          {briefing?.newsShock ? <span className="pill pill-warn">News alert</span> : null}
        </div>
      </header>

      {loading && !briefing ? (
        <div className="briefing-skel-block" aria-busy="true">
          <span className="skel-line" />
          <span className="skel-line" />
          <span className="skel-line skel-line-short" />
        </div>
      ) : (
        <p className="jarvis-type" aria-live="polite">
          {typed}
          {!reduce && typed && typed.length < (briefing?.spokenSummary.length ?? 0) ? (
            <span className="jarvis-caret">▋</span>
          ) : null}
        </p>
      )}

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
                  <span className={`side-tag side-${it.side.toLowerCase()}`}>{directionLabel(it.side)}</span>
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
                    <span className="pill">{c.kind}</span> <strong>{c.label}</strong>: {c.detail}
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
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  if (!idea || !onPrefill) return;
                  const v = validateAdvisorSuggestion(idea);
                  if (!v.ok) {
                    setError(`Prefill blocked: ${v.error}`);
                    return;
                  }
                  // Advisor may only prefill - never submit an order.
                  onPrefill({
                    ...idea,
                    side: v.suggestion.side,
                    symbol: v.suggestion.symbol,
                    entry: v.suggestion.entry,
                    stopLoss: v.suggestion.stopLoss,
                    takeProfit: v.suggestion.takeProfit,
                    confidence: v.suggestion.confidence,
                    reasoning: v.suggestion.reasoning || idea.reasoning,
                  });
                }}
              >
                Prefill SoDEX ticket
              </button>
            </div>
            <div className="jarvis-market">
              <div className="jarvis-market-head">
                <PairSelector value={symbol} onChange={setSymbol} />
                <div className="jarvis-market-pills">
                  <span className="pill">Live prices</span>
                  <span className="pill">Practice mode</span>
                </div>
              </div>
              <div className="jarvis-last">
                Last <LivePrice value={bundle?.ticker?.lastPrice ?? mid} />
                {bundle?.ticker ? (
                  <span className={bundle.ticker.changePct24h >= 0 ? 'up' : 'down'}>
                    {bundle.ticker.changePct24h >= 0 ? '+' : ''}
                    {bundle.ticker.changePct24h.toFixed(2)}%
                  </span>
                ) : null}
              </div>
              <SodexPriceChart
                klines={bundle?.klines ?? []}
                height={220}
                interval={interval}
                onInterval={setIntervalTf}
              />
              <SodexDepth book={bundle?.orderbook ?? null} height={280} />
            </div>
          </div>
        </motion.div>
      ) : null}

      <div className="jarvis-footer">
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh briefing
        </button>
      </div>
    </section>
  );
}
