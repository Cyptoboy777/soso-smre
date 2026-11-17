/**
 * Read-only SoDEX account-balance helpers.
 *
 * Spot:  GET /api/v1/spot/accounts/{addr}/balances  (id, coin, total, locked)
 * Perps: GET /api/v1/perps/accounts/{addr}/balances (id, coin, total, collateral, marginRatio, price; live responses also have borrowed)
 *
 * Perps (Margin & Futures) balances are not spendable for spot swaps. A signed
 * transferAsset is required first; this module only parses public reads.
 */

export type MarginBalance = {
  id: number;
  coin: string;
  total: number;
  collateral: number;
  marginRatio: number;
  price: number;
  borrowed: number;
};

const asNum = (v: unknown) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

/** Accepts the official envelope, the unwrapped `data` object, or a bare array. */
export function parsePerpsBalances(payload: unknown): MarginBalance[] {
  const root = payload && typeof payload === 'object' && 'data' in (payload as object)
    ? (payload as { data: unknown }).data
    : payload;
  const raw = Array.isArray(root)
    ? root
    : root && typeof root === 'object' && Array.isArray((root as { balances?: unknown }).balances)
      ? (root as { balances: unknown[] }).balances
      : [];
  const out: MarginBalance[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const coin = String(r.coin ?? '').trim();
    const total = asNum(r.total);
    if (!coin || total <= 0) continue;
    out.push({
      id: Number(r.id) || 0,
      coin,
      total,
      collateral: asNum(r.collateral),
      marginRatio: asNum(r.marginRatio),
      price: asNum(r.price),
      borrowed: asNum(r.borrowed),
    });
  }
  return out;
}

/** USD value: prefer the live spot ticker, fall back to the perps `price` field. */
export function marginUsd(b: { coin: string; total: number; price: number }, priceOf: (coin: string) => number): number {
  const p = priceOf(b.coin);
  return b.total * (p > 0 ? p : b.price || 0);
}
