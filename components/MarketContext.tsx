'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { EtfPanel, NewsPanel } from '@/types/flow';

type SectorMove = { name: string; changePct24h: number | null; dominance: number | null };
type SectorPanel = { sectors: SectorMove[]; spotlight: SectorMove[]; meta: { source: string; fetchedAt: string } };

type Slot<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'empty' };

async function load<T extends { meta: { source: string } }>(url: string): Promise<Slot<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { state: 'empty' };
    const json = (await res.json()) as T;
    return json?.meta?.source === 'live' ? { state: 'ready', data: json } : { state: 'empty' };
  } catch {
    return { state: 'empty' };
  }
}

function pct(v: number | null): string {
  if (v == null) return '—';
  const p = v * 100;
  return `${p > 0 ? '+' : ''}${p.toFixed(2)}%`;
}

function usdM(v: number): string {
  const m = v / 1_000_000;
  return `${m > 0 ? '+' : ''}${m.toLocaleString('en-US', { maximumFractionDigits: 1 })}M USD`;
}

function Empty({ what }: { what: string }) {
  return (
    <p className="ctx-empty" role="status">
      {what} is unavailable right now. Nothing is filled in with sample data.
    </p>
  );
}

/**
 * SoSoValue context for the swap: hot news, US spot BTC ETF flow and sector moves.
 * Context only. None of it places, sizes or signs an order.
 */
export function MarketContext() {
  const reduce = useReducedMotion();
  const [news, setNews] = useState<Slot<NewsPanel>>({ state: 'loading' });
  const [etf, setEtf] = useState<Slot<EtfPanel>>({ state: 'loading' });
  const [sectors, setSectors] = useState<Slot<SectorPanel>>({ state: 'loading' });

  useEffect(() => {
    void load<NewsPanel>('/api/soso/news').then(setNews);
    void load<EtfPanel>('/api/soso/etf?symbol=BTC').then(setEtf);
    void load<SectorPanel>('/api/soso/sectors').then(setSectors);
  }, []);

  const card = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
        };

  const latest = etf.state === 'ready' ? etf.data.latest : null;
  const movers =
    sectors.state === 'ready'
      ? [...sectors.data.sectors, ...sectors.data.spotlight]
          .filter((s) => s.changePct24h != null)
          .sort((a, b) => Math.abs(b.changePct24h ?? 0) - Math.abs(a.changePct24h ?? 0))
          .slice(0, 5)
      : [];

  return (
    <section className="ctx" aria-label="SoSoValue market context">
      <motion.article className="ctx-card ctx-news" {...card(0)}>
        <h3>Headlines</h3>
        {news.state === 'loading' ? (
          <div className="ctx-skeleton" aria-hidden />
        ) : news.state === 'ready' && news.data.items.length ? (
          <ul>
            {news.data.items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <a href={item.url} target="_blank" rel="noreferrer noopener">
                  {item.title}
                </a>
                <time dateTime={item.publishedAt}>
                  {new Date(item.publishedAt).toUTCString().slice(5, 22)} UTC
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <Empty what="SoSoValue news" />
        )}
      </motion.article>

      <motion.article className="ctx-card" {...card(1)}>
        <h3>US spot BTC ETF flow</h3>
        {etf.state === 'loading' ? (
          <div className="ctx-skeleton" aria-hidden />
        ) : latest ? (
          <>
            <p className={`ctx-figure tabular ${latest.totalNetInflow >= 0 ? 'up' : 'down'}`}>
              {usdM(latest.totalNetInflow)}
            </p>
            <p className="ctx-sub">Net flow on {latest.date}. Flows lag price and are not a signal by themselves.</p>
          </>
        ) : (
          <Empty what="ETF flow" />
        )}
      </motion.article>

      <motion.article className="ctx-card" {...card(2)}>
        <h3>Sector moves, 24h</h3>
        {sectors.state === 'loading' ? (
          <div className="ctx-skeleton" aria-hidden />
        ) : movers.length ? (
          <ul className="ctx-sectors">
            {movers.map((m) => (
              <li key={m.name}>
                <span>{m.name}</span>
                <span className={`tabular ${(m.changePct24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(m.changePct24h)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty what="Sector data" />
        )}
      </motion.article>
    </section>
  );
}
