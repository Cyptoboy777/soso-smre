/**
 * Auto PnL journal: pure logic, no network, no wallet address.
 * Input is real fills from SoDEX. Cost basis is average cost per pair, built only from fills we have seen.
 * A sell with no known cost basis is kept in the list but never counted in P&L (nothing is guessed).
 */

export type JFill = {
  id: string; // unique per fill, e.g. `${net}:${tradeID}`
  symbol: string; base: string; quote: string;
  side: 'buy' | 'sell';
  price: number; qty: number; fee: number; feeCoin: string; time: number; orderID: number;
};

export type JTrade = {
  id: string; symbol: string; base: string;
  closedAt: number;
  entry: number | null; exit: number; qty: number;
  pnl: number | null; pnlPct: number | null; fees: number;
};

export const JOURNAL_CAP = 2000;

export const normSide = (s: unknown): 'buy' | 'sell' => (/sell|^2$/i.test(String(s)) ? 'sell' : 'buy');

/** Merge new fills into saved ones: no duplicates, oldest first, bounded. */
export function mergeFills(existing: JFill[], incoming: JFill[], cap = JOURNAL_CAP): JFill[] {
  const map = new Map<string, JFill>();
  for (const f of existing) map.set(f.id, f);
  for (const f of incoming) if (isFinite(f.price) && isFinite(f.qty) && f.qty > 0 && f.price > 0) map.set(f.id, f);
  const all = [...map.values()].sort((a, b) => a.time - b.time || a.orderID - b.orderID);
  return all.length > cap ? all.slice(all.length - cap) : all;
}

type Exec = { key: string; symbol: string; base: string; quote: string; side: 'buy' | 'sell'; qty: number; quoteAmt: number; feeQuote: number; feeBase: number; time: number; orderID: number; fills: number };

function execs(fills: JFill[]): Exec[] {
  const m = new Map<string, Exec>();
  for (const f of fills) {
    const k = `${f.symbol}|${f.orderID}|${f.side}`;
    let e = m.get(k);
    if (!e) { e = { key: k, symbol: f.symbol, base: f.base, quote: f.quote, side: f.side, qty: 0, quoteAmt: 0, feeQuote: 0, feeBase: 0, time: f.time, orderID: f.orderID, fills: 0 }; m.set(k, e); }
    e.qty += f.qty; e.quoteAmt += f.qty * f.price; e.time = Math.max(e.time, f.time); e.fills++;
    if (f.feeCoin === f.quote) e.feeQuote += f.fee; else if (f.feeCoin === f.base || f.feeCoin === '') e.feeBase += f.fee;
  }
  return [...m.values()].sort((a, b) => a.time - b.time || a.orderID - b.orderID);
}

/** Closed trades (every sell execution), newest first. Fees are in quote coin (USDC). */
export function buildTrades(fills: JFill[]): JTrade[] {
  const pos = new Map<string, { qty: number; cost: number; fees: number }>();
  const out: JTrade[] = [];
  for (const e of execs(fills)) {
    const p = pos.get(e.symbol) ?? { qty: 0, cost: 0, fees: 0 };
    const px = e.qty > 0 ? e.quoteAmt / e.qty : 0;
    if (e.side === 'buy') {
      p.qty += e.qty - e.feeBase;
      p.cost += e.quoteAmt + e.feeQuote;
      p.fees += e.feeQuote + e.feeBase * px;
      pos.set(e.symbol, p);
      continue;
    }
    const sold = e.qty + e.feeBase; // base fee leaves the position too
    const sellFees = e.feeQuote + e.feeBase * px;
    const matched = Math.min(p.qty, sold);
    const id = `${e.symbol}:${e.orderID}`;
    if (matched <= 1e-12 || p.qty <= 1e-12) {
      out.push({ id, symbol: e.symbol, base: e.base, closedAt: e.time, entry: null, exit: px, qty: e.qty, pnl: null, pnlPct: null, fees: sellFees });
      continue;
    }
    const share = matched / sold; // part of this sell that has a known cost
    const avgCost = p.cost / p.qty;
    const proceeds = (e.quoteAmt - e.feeQuote) * share;
    const costOut = avgCost * matched;
    const entryFees = p.fees * (matched / p.qty);
    const pnl = proceeds - costOut;
    out.push({ id, symbol: e.symbol, base: e.base, closedAt: e.time, entry: avgCost, exit: px, qty: e.qty * share, pnl, pnlPct: costOut > 0 ? (pnl / costOut) * 100 : null, fees: sellFees * share + entryFees });
    p.cost -= costOut; p.fees -= entryFees; p.qty -= matched;
    pos.set(e.symbol, p);
  }
  return out.sort((a, b) => b.closedAt - a.closedAt);
}

export type Insight = {
  count: number; wins: number; losses: number; net: number; winRate: number;
  worstCoin: { base: string; losses: number; net: number } | null;
  worstPeriod: { label: string; losses: number; net: number } | null;
  lines: string[];
};

export const PERIODS = [{ from: 0, to: 6, label: 'at night (12am to 6am)' }, { from: 6, to: 12, label: 'in the morning (6am to 12pm)' }, { from: 12, to: 18, label: 'in the afternoon (12pm to 6pm)' }, { from: 18, to: 24, label: 'in the evening (6pm to 12am)' }];

const WEEK = 7 * 86_400_000;

/** Weekly insight from closed trades with a known cost. Needs at least 3 such trades, otherwise there is nothing honest to say. */
export function weeklyInsight(trades: JTrade[], now: number, tzOffsetMin = 0): Insight | null {
  const t = trades.filter((x) => x.pnl != null && x.closedAt >= now - WEEK && x.closedAt <= now + 60_000);
  if (t.length < 3) return null;
  const wins = t.filter((x) => (x.pnl as number) > 0).length;
  const losses = t.filter((x) => (x.pnl as number) < 0).length;
  const net = t.reduce((s, x) => s + (x.pnl as number), 0);

  const byCoin = new Map<string, { losses: number; net: number }>();
  const byPeriod = new Map<number, { losses: number; net: number }>();
  for (const x of t) {
    const pnl = x.pnl as number;
    const c = byCoin.get(x.base) ?? { losses: 0, net: 0 }; c.net += pnl; if (pnl < 0) c.losses++; byCoin.set(x.base, c);
    const h = new Date(x.closedAt + tzOffsetMin * 60_000).getUTCHours();
    const pi = PERIODS.findIndex((p) => h >= p.from && h < p.to);
    const q = byPeriod.get(pi) ?? { losses: 0, net: 0 }; q.net += pnl; if (pnl < 0) q.losses++; byPeriod.set(pi, q);
  }
  const pick = <K,>(m: Map<K, { losses: number; net: number }>) => [...m.entries()].filter(([, v]) => v.losses >= 2 && v.net < 0).sort((a, b) => b[1].losses - a[1].losses || a[1].net - b[1].net)[0];
  const wc = pick(byCoin);
  const wp = pick(byPeriod);
  const worstCoin = wc ? { base: wc[0], ...wc[1] } : null;
  const worstPeriod = wp ? { label: PERIODS[wp[0] as number].label, ...wp[1] } : null;

  const lines: string[] = [];
  if (worstCoin) lines.push(`Most of your losses this week were on ${worstCoin.base} (${worstCoin.losses} losing trades).`);
  if (worstPeriod) lines.push(`Your losing trades cluster ${worstPeriod.label} (${worstPeriod.losses} of them).`);
  if (!worstCoin && !worstPeriod) lines.push(losses === 0 ? 'No losing trades this week.' : 'Your losses this week were spread out, with no single coin or time of day standing out.');
  return { count: t.length, wins, losses, net, winRate: (wins / t.length) * 100, worstCoin, worstPeriod, lines };
}

/** Only a real, closed, profitable trade can be shared. */
export function isShareable(t: JTrade): boolean {
  return t.pnl != null && t.pnl > 0 && t.pnlPct != null && t.pnlPct > 0 && t.entry != null;
}

export function shareText(pair: string, pct: number): string {
  return `${pair} closed ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% on SoDEX with SoSwapDEX. soswapdex.xyz`;
}

export type PortfolioSnap = { t: number; usd: number };
const HOUR = 3_600_000;

/** One point per hour, kept for 8 days. */
export function recordSnapshot(snaps: PortfolioSnap[], now: number, usd: number): PortfolioSnap[] {
  if (!isFinite(usd) || usd < 0) return snaps;
  const last = snaps[snaps.length - 1];
  const next = last && now - last.t < HOUR ? [...snaps.slice(0, -1), { t: now, usd }] : [...snaps, { t: now, usd }];
  return next.filter((s) => s.t >= now - 8 * 24 * HOUR).slice(-200);
}

/** Change against the snapshot nearest to 24h ago. Needs a snapshot at least 6h old, else nothing is shown. Includes deposits and withdrawals. */
export function portfolioChange(snaps: PortfolioSnap[], now: number, usd: number): { change: number; pct: number | null; hours: number } | null {
  if (!isFinite(usd)) return null;
  const old = snaps.filter((s) => now - s.t >= 6 * HOUR && now - s.t <= 48 * HOUR);
  if (!old.length) return null;
  const ref = old.reduce((b, s) => (Math.abs(now - s.t - 24 * HOUR) < Math.abs(now - b.t - 24 * HOUR) ? s : b));
  return { change: usd - ref.usd, pct: ref.usd > 0 ? ((usd - ref.usd) / ref.usd) * 100 : null, hours: Math.round((now - ref.t) / HOUR) };
}
