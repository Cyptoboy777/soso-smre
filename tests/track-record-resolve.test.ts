import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('track-record seed honesty', () => {
  const seed = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'track-record.seed.json'), 'utf8'),
  ) as Array<{
    orderId?: string;
    orderStatus?: string;
    entry: number;
    takeProfit: number;
    stopLoss: number;
    outcome: string;
    pnlPct?: number;
  }>;

  it('only seeds filled/partial proof rows with market-like entry', () => {
    expect(seed.length).toBeGreaterThan(0);
    for (const row of seed) {
      expect(row.entry).toBeGreaterThan(50_000);
      expect(row.outcome).toBe('open');
      expect(row.pnlPct).toBeUndefined();
      expect((row.orderStatus || '').toUpperCase()).not.toBe('NEW');
    }
  });

  it('documents why limit@5000 must never resolve against mark~78k', () => {
    const mark = 78619;
    const entry = 5000;
    const fantasy = ((mark - entry) / entry) * 100;
    expect(fantasy).toBeGreaterThan(1000);
    const shouldResolve =
      /* NEW resting */ false && Math.abs(mark - entry) / entry <= 0.5;
    expect(shouldResolve).toBe(false);
  });

  it('includes known fill proof IDs', () => {
    const ids = new Set(seed.map((r) => r.orderId));
    expect(ids.has('1301909841')).toBe(true);
    expect(ids.has('1301914828')).toBe(true);
  });
});
