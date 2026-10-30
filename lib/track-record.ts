/**
 * Honest file-backed track record. Never invents PnL.
 * Stored under data/track-record.json on the server filesystem.
 */
import type { OutcomeStatus, Thesis, TrackRecordEntry } from '@/types/flow';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SEED = path.join(process.cwd(), 'data', 'track-record.seed.json');
/** Prefer writable /tmp on Vercel; fall back to repo data/ locally. */
const FILE = process.env.VERCEL
  ? path.join('/tmp', 'flowsentinel-track-record.json')
  : path.join(process.cwd(), 'data', 'track-record.json');

let memoryCache: TrackRecordEntry[] | null = null;

function readSeed(): TrackRecordEntry[] {
  try {
    if (!fs.existsSync(SEED)) return [];
    return JSON.parse(fs.readFileSync(SEED, 'utf8')) as TrackRecordEntry[];
  } catch {
    return [];
  }
}

function mergeSeed(rows: TrackRecordEntry[]): TrackRecordEntry[] {
  const seed = readSeed();
  const ids = new Set(rows.map((r) => r.id));
  const orderIds = new Set(rows.map((r) => r.orderId).filter(Boolean));
  for (const s of seed) {
    if (ids.has(s.id)) continue;
    if (s.orderId && orderIds.has(s.orderId)) continue;
    rows.unshift(s);
  }
  return rows;
}

function ensure(): TrackRecordEntry[] {
  if (memoryCache) return memoryCache;
  try {
    const seed = readSeed();
    if (!fs.existsSync(FILE)) {
      memoryCache = mergeSeed([...seed]);
      try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(memoryCache, null, 2), 'utf8');
      } catch {
        /* read-only FS — memory only */
      }
      return memoryCache;
    }
    const raw = fs.readFileSync(FILE, 'utf8');
    const rows = mergeSeed(JSON.parse(raw) as TrackRecordEntry[]);
    memoryCache = rows;
    return rows;
  } catch {
    memoryCache = mergeSeed(readSeed());
    return memoryCache;
  }
}

function save(rows: TrackRecordEntry[]) {
  memoryCache = rows;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
  } catch {
    /* Vercel read-only — keep in-memory for this isolate */
  }
}

export function listTrackRecord(): TrackRecordEntry[] {
  return ensure().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function logIdea(
  thesis: Thesis,
  orderMode: TrackRecordEntry['orderMode'],
  orderId?: string,
): TrackRecordEntry {
  const rows = ensure();
  const entry: TrackRecordEntry = {
    id: `tr_${crypto.randomBytes(5).toString('hex')}`,
    thesisId: thesis.id,
    createdAt: Number.isFinite(Date.parse(thesis.createdAt)) ? thesis.createdAt : new Date().toISOString(),
    side: thesis.side,
    symbol: thesis.symbol,
    entry: thesis.entry,
    stopLoss: thesis.stopLoss,
    takeProfit: thesis.takeProfit,
    confidence: thesis.confidence,
    plainEnglish: thesis.plainEnglish,
    orderMode,
    orderId,
    horizonHours: thesis.horizonHours || 24,
    resolveAfter: new Date(
      (Number.isFinite(Date.parse(thesis.createdAt)) ? Date.parse(thesis.createdAt) : Date.now()) +
        (thesis.horizonHours || 24) * 3600_000,
    ).toISOString(),
    outcome: thesis.side === 'FLAT' ? 'cancelled' : 'open',
    drivers: thesis.drivers,
  };
  rows.unshift(entry);
  save(rows.slice(0, 500));
  return entry;
}

/**
 * Resolve open ideas when a mark price is supplied (from live tickers or later cron).
 * Does not invent prices — if mark is missing, leaves open.
 */
export function resolveOpen(marks: Record<string, number>, now = Date.now()): TrackRecordEntry[] {
  const rows = ensure();
  let changed = false;
  for (const row of rows) {
    if (row.outcome !== 'open') continue;
    const mark = marks[row.symbol];
    if (mark == null || !Number.isFinite(mark)) continue;

    let outcome: OutcomeStatus = 'open';
    if (row.side === 'LONG') {
      if (mark >= row.takeProfit) outcome = 'hit_tp';
      else if (mark <= row.stopLoss) outcome = 'hit_sl';
    } else if (row.side === 'SHORT') {
      if (mark <= row.takeProfit) outcome = 'hit_tp';
      else if (mark >= row.stopLoss) outcome = 'hit_sl';
    }

    const expired = now >= Date.parse(row.resolveAfter);
    if (outcome === 'open' && expired) outcome = 'expired';

    if (outcome !== 'open') {
      row.outcome = outcome;
      row.exitPrice = mark;
      const dir = row.side === 'SHORT' ? -1 : 1;
      row.pnlPct = Number((((mark - row.entry) / row.entry) * 100 * dir).toFixed(3));
      row.resolvedAt = new Date(now).toISOString();
      changed = true;
    }
  }
  if (changed) save(rows);
  return rows;
}

export function hitRate(rows: TrackRecordEntry[] = listTrackRecord()): {
  total: number;
  resolved: number;
  wins: number;
  losses: number;
  hitRate: number | null;
} {
  const resolved = rows.filter((r) => r.outcome === 'hit_tp' || r.outcome === 'hit_sl' || r.outcome === 'expired');
  const wins = resolved.filter((r) => r.outcome === 'hit_tp' || (r.pnlPct != null && r.pnlPct > 0)).length;
  const losses = resolved.filter((r) => r.outcome === 'hit_sl' || (r.pnlPct != null && r.pnlPct < 0)).length;
  const scored = wins + losses;
  return {
    total: rows.length,
    resolved: resolved.length,
    wins,
    losses,
    hitRate: scored === 0 ? null : Number(((wins / scored) * 100).toFixed(1)),
  };
}


export function updateOrderStatus(trackId: string, status: string, extra?: Partial<TrackRecordEntry>) {
  const rows = ensure();
  const row = rows.find((r) => r.id === trackId);
  if (!row) return null;
  (row as TrackRecordEntry & { orderStatus?: string }).orderStatus = status;
  if (extra) Object.assign(row, extra);
  save(rows);
  return row;
}
