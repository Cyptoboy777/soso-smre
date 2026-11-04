'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import type { JarvisBriefing, JarvisCitation, JarvisIdea, SodexMarketBundle } from '@/types/flow';
import { validateAdvisorSuggestion } from '@/lib/advisor-suggestions';
import {
  formatPair,
  formatPrice,
  formatSideLabel,
  riskReward,
  sanitizePublicText,
  stripNewsTokens,
  timeAgo,
} from '@/lib/display';
import { PairSelector } from './PairSelector';
import { LivePrice } from './LivePrice';

const SodexPriceChart = dynamic(() => import('./SodexPriceChart').then((m) => m.SodexPriceChart), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 160 }} />,
});
const SodexDepth = dynamic(() => import('./SodexDepth').then((m) => m.SodexDepth), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 180 }} />,
});

function useTypewriter(text: string, active: boolean, cps = 48) {
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
    }, Math.max(10, 1000 / cps));
    return () => window.clearInterval(id);
  }, [text, active, cps]);
  return out;
}

function sourceIcon(kind: JarvisCitation['kind']) {
  if (kind === 'etf') return '◈';
  if (kind === 'ssi') return '◉';
  if (kind === 'market') return '◎';
  return '✦';
}

function sourceKindLabel(kind: JarvisCitation['kind']) {
  if (kind === 'etf') return 'ETF flow';
  if (kind === 'ssi') return 'SSI';
  if (kind === 'market') return 'Market';
  return 'News';
}

function cleanLabel(label: string) {
  return stripNewsTokens(label)
    .replace(/^\[([^\]]+)\]\s*/g, '$1 · ')
    .replace(/^news\s*[:·-]\s*/i, '')
    .trim();
}

function BriefingBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 220;
  const needs = text.length > limit;
  const shown = !needs || expanded ? text : `${text.slice(0, text.lastIndexOf(' ', limit) > 80 ? text.lastIndexOf(' ', limit) : limit).trimEnd()}…`;
  return (
    <div className="jarvis-briefing-body">
      <p className="jarvis-type" aria-live="polite">
        {shown}
      </p>
      {needs ? (
        <button type="button" className="linkish" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </div>
  );
}

function TradePlanCard({
  idea,
  mid,
}: {
  idea: JarvisIdea;
  mid: number | null;
}) {
  const rr = riskReward(idea.entry, idea.stopLoss, idea.takeProfit, idea.side);
  return (
    <div className="trade-plan" aria-label="Trade plan">
      <div className="trade-plan-head">
        <h3>Trade plan</h3>
        {rr ? <span className="trade-plan-rr">Risk : reward {rr}</span> : null}
      </div>
      <div className="trade-plan-grid">
        <div className="trade-plan-cell is-entry">
          <span className="tp-label">Entry</span>
          <strong className="tabular">{formatPrice(idea.entry)}</strong>
        </div>
        <div className="trade-plan-cell is-stop loss">
          <span className="tp-label">Stop</span>
          <strong className="tabular">{formatPrice(idea.stopLoss)}</strong>
        </div>
        <div className="trade-plan-cell is-target gain">
          <span className="tp-label">Target</span>
          <strong className="tabular">{formatPrice(idea.takeProfit)}</strong>
        </div>
        <div className="trade-plan-cell is-mid">
          <span className="tp-label">Mid price</span>
          <strong className="tabular">{mid != null ? formatPrice(mid) : '—'}</strong>
        </div>
      </div>
    </div>
  );
}

function SourcesList({ citations, asOf }: { citations: JarvisCitation[]; asOf?: string }) {
  if (!citations.length) return <p className="muted">No sources for this idea yet.</p>;
  return (
    <ul className="source-list">
      {citations.map((c, idx) => {
        const title = cleanLabel(c.label) || sourceKindLabel(c.kind);
        const detail = sanitizePublicText(c.detail).slice(0, 140);
        const ago = timeAgo(asOf);
        const inner = (
          <>
            <span className="source-icon" aria-hidden>
              {sourceIcon(c.kind)}
            </span>
            <span className="source-body">
              <span className="source-top">
                <strong>{title}</strong>
                <span className="source-meta">
                  {sourceKindLabel(c.kind)}
                  {ago ? ` · ${ago}` : ''}
                </span>
              </span>
              {detail ? <span className="source-detail">{detail}</span> : null}
            </span>
          </>
        );
        return (
          <li key={`${c.kind}-${idx}`} className="source-card">
            {c.url ? (
              <a href={c.url} target="_blank" rel="noreferrer noopener" className="source-link">
                {inner}
              </a>
            ) : (
              <div className="source-link">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function JarvisPanel({ onPrefill }: { onPrefill?: (idea: JarvisIdea) => void }) {
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
      setSymbol(sym);
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
  const summary = sanitizePublicText(briefing?.spokenSummary ?? '');
  const typed = useTypewriter(summary, Boolean(briefing) && !reduce && summary.length < 280);

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
    if (!bundle?.orderbook) return bundle?.ticker?.lastPrice ?? null;
    const bid = bundle.orderbook.bids[0]?.price;
    const ask = bundle.orderbook.asks[0]?.price;
    if (bid && ask) return (bid + ask) / 2;
    return bundle.ticker?.lastPrice ?? null;
  }, [bundle]);

  const newsChips = useMemo(() => {
    if (!idea) return [];
    return idea.citations
      .filter((c) => c.kind === 'news' && (c.url || c.label))
      .slice(0, 3)
      .map((c) => ({
        label: cleanLabel(c.label).slice(0, 64),
        url: c.url,
      }));
  }, [idea]);

  return (
    <section className="jarvis-panel glass-card" aria-label="Desk briefing">
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
          <span className="status-pill is-live">
            <span className="live-dot" aria-hidden />
            Live prices
          </span>
          <span className="status-pill">Practice mode</span>
          {briefing?.newsShock ? <span className="status-pill is-warn">News alert</span> : null}
        </div>
      </header>

      {loading && !briefing ? (
        <div className="briefing-skel-block" aria-busy="true">
          <span className="skel-line" />
          <span className="skel-line" />
          <span className="skel-line skel-line-short" />
        </div>
      ) : briefing ? (
        reduce || summary.length >= 280 ? (
          <BriefingBody text={summary} />
        ) : (
          <p className="jarvis-type" aria-live="polite">
            {typed}
            {typed.length < summary.length ? <span className="jarvis-caret">▋</span> : null}
          </p>
        )
      ) : null}

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
                  <span className={`side-tag side-${it.side.toLowerCase()}`}>{formatSideLabel(it.side)}</span>
                  <span className="conf">{it.confidence}%</span>
                </div>
                <strong>{sanitizePublicText(it.title)}</strong>
                <p>{sanitizePublicText(it.reasoning)}</p>
                {selected === i && newsChips.length ? (
                  <div className="news-chip-row" onClick={(e) => e.stopPropagation()}>
                    {newsChips.map((chip, idx) =>
                      chip.url ? (
                        <a key={idx} className="news-chip" href={chip.url} target="_blank" rel="noreferrer noopener">
                          {chip.label}
                        </a>
                      ) : (
                        <span key={idx} className="news-chip">
                          {chip.label}
                        </span>
                      ),
                    )}
                  </div>
                ) : null}
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
            <div className="jarvis-detail-main">
              <h3 style={{ marginTop: 0 }}>Sources</h3>
              <SourcesList citations={idea.citations} asOf={briefing?.asOf} />
              <div className="risk-block">
                <p>
                  <strong>Risk</strong>
                  <span>{sanitizePublicText(idea.riskNote)}</span>
                </p>
                <p>
                  <strong>Invalidation</strong>
                  <span>{sanitizePublicText(idea.invalidation)}</span>
                </p>
              </div>
              <TradePlanCard idea={idea} mid={mid} />
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
                Prefill practice ticket
              </button>
            </div>
            <div className="jarvis-market">
              <div className="jarvis-market-head">
                <PairSelector value={symbol} onChange={setSymbol} />
                <div className="jarvis-market-pills">
                  <span className="status-pill is-live">
                    <span className="live-dot" aria-hidden />
                    Live prices
                  </span>
                  <span className="status-pill">Practice mode</span>
                </div>
              </div>
              <div className="jarvis-last">
                <span className="muted">{formatPair(symbol)}</span>
                <LivePrice value={bundle?.ticker?.lastPrice ?? mid} />
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
              <SodexDepth book={bundle?.orderbook ?? null} height={260} />
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
