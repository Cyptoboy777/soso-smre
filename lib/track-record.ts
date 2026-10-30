/**
 * Honest file-backed track record. Never invents PnL.
 * Stored under data/track-record.json on the server filesystem.
 */
import type { OutcomeStatus, Thesis, TrackRecordEntry } from '@/types/flow';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FILE = path.join(process.cwd(), 'data', 'track-record.json');

function ensure(): TrackRecordEntry[] {
  try {
    if (!fs.existsSync(FILE)) {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw) as TrackRecordEntry[];
  } catch {
    return [];
  }
}

function save(rows: TrackRecordEntry[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
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
    createdAt: thesis.createdAt,
    side: thesis.side,
    symbol: thesis.symbol,
    entry: thesis.entry,
    stopLoss: thesis.stopLoss,
    takeProfit: thesis.takeProfit,
    confidence: thesis.confidence,
    plainEnglish: thesis.plainEnglish,
    orderMode,
    orderId,
    horizonHours: thesis.horizonHours,
    resolveAfter: new Date(Date.parse(thesis.createdAt) + thesis.horizonHours * 3600_000).toISOString(),
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
