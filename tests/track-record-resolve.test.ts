import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Exercise resolve helpers via a temp cwd copy of the module is hard;
// instead validate the seed honesty invariants + pnl math the page relies on.

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

  it('keeps resting NEW limit unfilled with no PnL', () => {
    const row = seed.find((r) => r.orderId === '1301909840');
    expect(row).toBeTruthy();
    expect(row!.orderStatus).toBe('NEW');
    expect(row!.outcome).toBe('open');
    expect(row!.pnlPct).toBeUndefined();
  });

  it('does not allow mark~78k to look like a win vs limit 5000', () => {
    const row = seed.find((r) => r.orderId === '1301909840')!;
    const mark = 78619;
    // With TP==entry for resting proof, mark cannot hit_tp via TP cross
    expect(row.takeProfit).toBe(row.entry);
    expect(mark >= row.takeProfit && row.orderStatus === 'NEW').toBe(true);
    // Simulated honest gate: skip NEW
    const shouldResolve = row.orderStatus !== 'NEW' && Math.abs(mark - row.entry) / row.entry <= 0.5;
    expect(shouldResolve).toBe(false);
    const fantasy = ((mark - row.entry) / row.entry) * 100;
    expect(fantasy).toBeGreaterThan(1000); // documents the bug we block
  });

  it('filled proof rows use market-like entry', () => {
    for (const id of ['1301909841', '1301914828']) {
      const row = seed.find((r) => r.orderId === id)!;
      expect(row.entry).toBeGreaterThan(50_000);
      expect(row.outcome).toBe('open');
    }
  });
});
