/** "Today on SoDEX": pure builder. Every part is optional and is simply left out when its data is missing. */

export type BriefTicker = { name: string; display: string; base: string; halted: boolean; changePct: number; quoteVol: number; last: number };
export type BriefNews = { id: string; title: string; url: string; time: number; source?: string };
export type BriefEtf = { asset: 'BTC' | 'ETH'; date: string; inflow: number };
export type Brief = {
  movers: { gainers: BriefTicker[]; losers: BriefTicker[] } | null;
  etf: BriefEtf[];
  headlines: BriefNews[];
};

/** Ignore thin markets so one tiny trade cannot top the list. */
export const MIN_MOVER_VOLUME = 2000;

export function pickMovers(all: BriefTicker[], n = 3): Brief['movers'] {
  const ok = all.filter((t) => !t.halted && isFinite(t.changePct) && t.last > 0 && t.quoteVol >= MIN_MOVER_VOLUME);
  if (ok.length < 2) return null;
  const sorted = [...ok].sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.filter((t) => t.changePct > 0).slice(0, n);
  const losers = [...sorted].reverse().filter((t) => t.changePct < 0).slice(0, n);
  return gainers.length || losers.length ? { gainers, losers } : null;
}

export function pickHeadlines(news: BriefNews[] | null | undefined, n = 3): BriefNews[] {
  if (!news) return [];
  const seen = new Set<string>();
  const out: BriefNews[] = [];
  for (const x of [...news].sort((a, b) => b.time - a.time)) {
    const key = x.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
    if (!x.title || seen.has(key)) continue;
    seen.add(key); out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

export function buildBrief(tickers: BriefTicker[], news: BriefNews[] | null | undefined, etf: (BriefEtf | null | undefined)[]): Brief {
  return { movers: pickMovers(tickers), etf: etf.filter((x): x is BriefEtf => !!x && !!x.date && isFinite(x.inflow)), headlines: pickHeadlines(news) };
}

export const briefIsEmpty = (b: Brief) => !b.movers && !b.etf.length && !b.headlines.length;
