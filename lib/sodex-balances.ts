/**
 * Read-only SoDEX account-balance helpers.
 *
 * Spot:  GET /api/v1/spot/accounts/{addr}/balances  (id, coin, total, locked)
 * Perps: GET /api/v1/perps/accounts/{addr}/balances (id, coin, total, collateral, marginRatio, price; live responses also have borrowed)
 * Perps state: GET /api/v1/perps/accounts/{addr}/state returns WsPerpsState
 *   (aid, amw, B[].i/a/wb/at/…). `at` is the per-coin available wallet balance
 *   for transfer / withdrawal. `amw` is account-level available margin for transfer.
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
  /** Canonical decimal string of `at`. null when SoDEX did not report it. */
  available: string | null;
};

export type PerpsAccountState = {
  accountID: number | null;
  amw: string | null;
  balances: MarginBalance[];
};

const asNum = (v: unknown) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

function unwrap(payload: unknown): unknown {
  return payload && typeof payload === 'object' && 'data' in (payload as object)
    ? (payload as { data: unknown }).data
    : payload;
}

function canonicalAmount(v: unknown): string | null {
  if (v == null || v === '') return null;
  const raw = String(v).trim();
  if (!raw || raw.startsWith('-') || /[eE+]/.test(raw)) return null;
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const [intRaw, fracRaw = ''] = raw.split('.');
  const int = intRaw.replace(/^0+/, '') || '0';
  const frac = fracRaw.replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

function rowFrom(r: Record<string, unknown>): MarginBalance | null {
  const coin = String(r.a ?? r.coin ?? '').trim();
  const total = asNum(r.wb ?? r.total);
  if (!coin || total <= 0) return null;
  const id = Number(r.i ?? r.id) || 0;
  const available = 'at' in r ? canonicalAmount(r.at) : null;
  return {
    id,
    coin,
    total,
    collateral: asNum(r.co ?? r.collateral),
    marginRatio: asNum(r.mr ?? r.marginRatio),
    price: asNum(r.px ?? r.price),
    borrowed: asNum(r.borrowed),
    available,
  };
}

/** Accepts the official envelope, the unwrapped `data` object, or a bare array. */
export function parsePerpsBalances(payload: unknown): MarginBalance[] {
  const root = unwrap(payload);
  const raw = Array.isArray(root)
    ? root
    : root && typeof root === 'object' && Array.isArray((root as { balances?: unknown }).balances)
      ? (root as { balances: unknown[] }).balances
      : [];
  const out: MarginBalance[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const parsed = rowFrom(row as Record<string, unknown>);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Accepts a WsPerpsState object, the official envelope, or a balances snapshot. */
export function parsePerpsState(payload: unknown): PerpsAccountState {
  const root = unwrap(payload);
  if (!root || typeof root !== 'object') return { accountID: null, amw: null, balances: [] };
  const r = root as Record<string, unknown>;
  const aid = Number(r.aid ?? r.accountID);
  const accountID = Number.isInteger(aid) && aid > 0 ? aid : null;
  const amw = canonicalAmount(r.amw);
  const list = Array.isArray(r.B) ? r.B : Array.isArray(r.balances) ? r.balances : [];
  const balances: MarginBalance[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const parsed = rowFrom(row as Record<string, unknown>);
    if (parsed) balances.push(parsed);
  }
  return { accountID, amw, balances };
}

/** USD value: prefer the live spot ticker, fall back to the perps `price` field. */
export function marginUsd(b: { coin: string; total: number; price: number }, priceOf: (coin: string) => number): number {
  const p = priceOf(b.coin);
  return b.total * (p > 0 ? p : b.price || 0);
}
