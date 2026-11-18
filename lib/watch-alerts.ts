/**
 * Watchlist alerts: pure decision logic. Decides which alerts to raise for starred pairs from data the app already loads.
 * It never trades. Delivery (toast / browser notification) lives in the UI.
 */

export type WatchItem = { name: string; display: string; base: string; aliases: string[]; etfAsset: 'BTC' | 'ETH' | null };
export type WatchSettings = { enabled: boolean; price: boolean; news: boolean; etf: boolean; movePct: number };
export type WatchNews = { id: string; title: string; summary?: string; time: number };
export type WatchSeen = { news: string[]; etf: string[]; move: string[]; baselined: boolean };
export type WatchAlert = { id: string; kind: 'price' | 'news' | 'etf'; pair: string; title: string; body: string };

export const DEFAULT_WATCH: WatchSettings = { enabled: false, price: true, news: true, etf: true, movePct: 5 };
export const EMPTY_SEEN: WatchSeen = { news: [], etf: [], move: [], baselined: false };
const KEEP = 300;

export function readSettings(raw: unknown): WatchSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const mv = Number(o.movePct);
  return {
    enabled: o.enabled === true, price: o.price !== false, news: o.news !== false, etf: o.etf !== false,
    movePct: isFinite(mv) && mv >= 1 && mv <= 50 ? mv : DEFAULT_WATCH.movePct,
  };
}
export function readSeen(raw: unknown): WatchSeen {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-KEEP) : []);
  return { news: arr(o.news), etf: arr(o.etf), move: arr(o.move), baselined: o.baselined === true };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word, case-insensitive match so "ETH" does not match "method". */
export function mentions(text: string, aliases: string[]): boolean {
  return aliases.some((a) => a.length >= 2 && new RegExp(`(^|[^A-Za-z0-9])${esc(a)}($|[^A-Za-z0-9])`, 'i').test(text));
}

export type WatchCtx = {
  items: WatchItem[];
  tickers: Record<string, { changePct: number; last: number }>;
  news: WatchNews[] | null; // null = feed missing: no news alerts
  etf: Partial<Record<'BTC' | 'ETH', { date: string; inflow: number } | null>> | null;
  now: number;
  day: string; // local calendar day, e.g. 2026-11-17
};

const fmtMoney = (n: number) => `${n >= 0 ? '+' : '-'}$${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(n))}`;

/** Returns new alerts and the updated seen state. The first run only records what already exists, so enabling alerts never floods the user. */
export function evaluateWatch(settings: WatchSettings, ctx: WatchCtx, seen: WatchSeen): { alerts: WatchAlert[]; seen: WatchSeen } {
  const next: WatchSeen = { news: [...seen.news], etf: [...seen.etf], move: [...seen.move], baselined: true };
  const alerts: WatchAlert[] = [];
  const first = !seen.baselined;
  if (!settings.enabled || !ctx.items.length) return { alerts, seen };

  if (settings.price) {
    for (const it of ctx.items) {
      const t = ctx.tickers[it.name];
      if (!t || !isFinite(t.changePct)) continue;
      if (Math.abs(t.changePct) < settings.movePct) continue;
      const id = `${it.name}:${t.changePct > 0 ? 'up' : 'down'}:${ctx.day}`;
      if (next.move.includes(id)) continue;
      next.move.push(id);
      if (first) continue;
      alerts.push({ id, kind: 'price', pair: it.name, title: `${it.display} is ${t.changePct > 0 ? 'up' : 'down'} ${Math.abs(t.changePct).toFixed(1)}% today`, body: 'Open Swap to check the live route and cost. Nothing is traded for you.' });
    }
  }

  if (settings.news && ctx.news) {
    for (const n of ctx.news) {
      if (next.news.includes(n.id)) continue;
      next.news.push(n.id);
      if (first) continue;
      if (ctx.now - n.time > 6 * 3_600_000) continue; // only fresh headlines
      const it = ctx.items.find((x) => mentions(`${n.title} ${n.summary ?? ''}`.slice(0, 600), x.aliases));
      if (it) alerts.push({ id: `news:${n.id}`, kind: 'news', pair: it.name, title: `${it.base} in the news`, body: n.title.slice(0, 140) });
    }
  }

  if (settings.etf && ctx.etf) {
    const done = new Set<string>();
    for (const it of ctx.items) {
      if (!it.etfAsset || done.has(it.etfAsset)) continue;
      const d = ctx.etf[it.etfAsset];
      if (!d || !d.date) continue;
      done.add(it.etfAsset);
      const id = `${it.etfAsset}:${d.date}`;
      if (next.etf.includes(id)) continue;
      next.etf.push(id);
      if (first) continue;
      alerts.push({ id: `etf:${id}`, kind: 'etf', pair: it.name, title: `${it.etfAsset} spot ETFs: ${fmtMoney(d.inflow)} net flow`, body: `Reported for ${d.date}. Open Swap to check ${it.display}.` });
    }
  }

  next.news = next.news.slice(-KEEP); next.etf = next.etf.slice(-KEEP); next.move = next.move.slice(-KEEP);
  return { alerts, seen: next };
}
