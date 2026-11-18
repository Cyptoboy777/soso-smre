/**
 * Paper trading for armed setups: pure logic. A paper trade copies a ready setup (entry, stop, target, size)
 * and is then followed against live prices. No order is ever sent. Results are kept only in this browser.
 */

export type PaperPos = {
  id: string; pair: string; display: string; grade: string;
  openedAt: number; entry: number; stop: number; tp1: number; qty: number; feePct: number; maxHours: number;
  /** Perps paper trades can be short. Missing means long (spot). */ side?: 'long' | 'short'; lev?: number;
};
export type PaperClosed = PaperPos & { closedAt: number; exit: number; reason: 'target' | 'stop' | 'timeout'; pnl: number; pnlPct: number };

export function openPaper(s: { pair: string; display: string; grade: string; entry: number; stop: number; tp1: number; qty: number; side?: 'long' | 'short'; lev?: number }, now: number, feePct: number, maxHours = 48): PaperPos | null {
  const short = s.side === 'short';
  if (!(s.entry > 0 && s.stop > 0 && s.tp1 > 0 && s.qty > 0)) return null;
  if (short ? !(s.stop > s.entry && s.tp1 < s.entry) : !(s.stop < s.entry && s.tp1 > s.entry)) return null;
  const pos: PaperPos = { id: `${s.pair}:${now}`, pair: s.pair, display: s.display, grade: s.grade, openedAt: now, entry: s.entry, stop: s.stop, tp1: s.tp1, qty: s.qty, feePct, maxHours };
  if (s.side) pos.side = s.side;
  if (s.lev) pos.lev = s.lev;
  return pos;
}

/** Closes the position when the live price reaches the stop or target, or when time runs out. Stop wins if both are true. */
export function stepPaper(p: PaperPos, price: number, now: number): PaperClosed | null {
  if (!(price > 0)) return null;
  let reason: PaperClosed['reason'] | null = null, exit = price;
  const short = p.side === 'short';
  if (short ? price >= p.stop : price <= p.stop) { reason = 'stop'; exit = price; }
  else if (short ? price <= p.tp1 : price >= p.tp1) { reason = 'target'; exit = price; }
  else if (now - p.openedAt >= p.maxHours * 3_600_000) { reason = 'timeout'; exit = price; }
  if (!reason) return null;
  const fees = (p.entry * p.qty + exit * p.qty) * (p.feePct / 100);
  const pnl = (short ? p.entry - exit : exit - p.entry) * p.qty - fees;
  return { ...p, closedAt: now, exit, reason, pnl, pnlPct: (pnl / (p.entry * p.qty)) * 100 };
}

export function paperStats(list: PaperClosed[]) {
  const wins = list.filter((x) => x.pnl > 0).length;
  const net = list.reduce((s, x) => s + x.pnl, 0);
  return { n: list.length, wins, losses: list.filter((x) => x.pnl < 0).length, winRate: list.length ? (wins / list.length) * 100 : 0, net };
}

export const PAPER_CAP = 100;
export const readPaper = <T,>(raw: unknown): T[] => (Array.isArray(raw) ? (raw.filter((x) => x && typeof x === 'object') as T[]).slice(-PAPER_CAP) : []);
