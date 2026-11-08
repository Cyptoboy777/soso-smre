/**
 * Public SoDEX market data (no API keys).
 * Prefer MAINNET for live prices / books / klines (read-only).
 * Order signing remains testnet/practice-only elsewhere.
 */
import type {
  MarketTicker,
  SodexBookLevel,
  SodexKline,
  SodexMarketBundle,
  SodexOrderBook,
  SodexTradePrint,
  SourceMeta,
} from '@/types/flow';

const TESTNET = 'https://testnet-gw.sodex.dev';
const MAINNET = 'https://mainnet-gw.sodex.dev';

function meta(source: SourceMeta['source'], endpoint?: string, note?: string): SourceMeta {
  return { source, endpoint, fetchedAt: new Date().toISOString(), note };
}

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function getJson(
  base: string,
  path: string,
): Promise<{ ok: true; data: unknown; base: string } | { ok: false; error: string; base: string }> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, base };
    const body = (await res.json()) as { code?: number; data?: unknown; msg?: string };
    if (typeof body.code === 'number' && body.code !== 0) {
      return { ok: false, error: `code ${body.code}: ${body.msg ?? '?'}`, base };
    }
    return { ok: true, data: body.data ?? body, base };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), base };
  }
}

/** Prefer mainnet for live public market reads; fall back to testnet. */
async function publicFirst(path: string) {
  const a = await getJson(MAINNET, path);
  if (a.ok) return { ...a, gateway: 'mainnet' as const };
  const b = await getJson(TESTNET, path);
  if (b.ok) return { ...b, gateway: 'testnet' as const };
  return { ok: false as const, error: `mainnet: ${a.error}; testnet: ${b.error}`, gateway: 'fallback' as const };
}

function mapLevels(rows: unknown): SodexBookLevel[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (Array.isArray(row)) return { price: n(row[0]), qty: n(row[1]) };
      const r = row as Record<string, unknown>;
      return { price: n(r.price ?? r.px), qty: n(r.qty ?? r.sz) };
    })
    .filter((l) => l.price > 0 && l.qty > 0);
}

/** Drop junk / far-away levels that break the ladder (common on thin testnet books). */
export function filterBookLevels(
  levels: SodexBookLevel[],
  mid: number,
  side: 'bid' | 'ask',
  maxPct = 0.04,
): SodexBookLevel[] {
  if (!Number.isFinite(mid) || mid <= 0) return levels.slice(0, 16);
  const lo = mid * (1 - maxPct);
  const hi = mid * (1 + maxPct);
  const filtered = levels.filter((l) => l.price >= lo && l.price <= hi);
  const sorted =
    side === 'bid'
      ? [...filtered].sort((a, b) => b.price - a.price)
      : [...filtered].sort((a, b) => a.price - b.price);
  return sorted.slice(0, 14);
}

/** Public book on one network. Does not fall back to the other network. */
export async function fetchOrderBookForNetwork(
  symbol: string,
  network: 'mainnet' | 'testnet',
  limit = 40,
  engine: 'spot' | 'perps' = 'spot',
): Promise<SodexOrderBook | null> {
  const base = network === 'mainnet' ? MAINNET : TESTNET;
  const path = `/api/v1/${engine}/markets/${encodeURIComponent(symbol)}/orderbook?limit=${limit}`;
  const res = await getJson(base, path);
  if (!res.ok) return null;
  const d = res.data as { bids?: unknown; asks?: unknown; blockTime?: number; updateID?: number };
  let bids = mapLevels(d.bids);
  let asks = mapLevels(d.asks);
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk || 0;
  bids = filterBookLevels(bids, mid, 'bid');
  asks = filterBookLevels(asks, mid, 'ask');
  return {
    symbol,
    bids,
    asks,
    blockTime: n(d.blockTime),
    updateId: n(d.updateID),
    gateway: network,
    meta: meta('live'),
  };
}

export async function fetchKlinesForNetwork(
  symbol: string,
  network: 'mainnet' | 'testnet',
  interval = '1h',
  limit = 48,
): Promise<SodexKline[]> {
  const base = network === 'mainnet' ? MAINNET : TESTNET;
  const path = `/api/v1/spot/markets/${encodeURIComponent(symbol)}/klines?interval=${interval}&limit=${limit}`;
  const res = await getJson(base, path);
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data.map((r) => {
    const x = r as Record<string, unknown>;
    return { t: n(x.t), o: n(x.o), h: n(x.h), l: n(x.l), c: n(x.c), v: n(x.v) };
  });
}

export async function fetchOrderBook(symbol: string, limit = 40): Promise<SodexOrderBook | null> {
  const path = `/api/v1/spot/markets/${encodeURIComponent(symbol)}/orderbook?limit=${limit}`;
  const res = await publicFirst(path);
  if (!res.ok) return null;
  const d = res.data as {
    bids?: unknown;
    asks?: unknown;
    blockTime?: number;
    updateID?: number;
  };
  let bids = mapLevels(d.bids);
  let asks = mapLevels(d.asks);
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const mid =
    bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk || 0;
  bids = filterBookLevels(bids, mid, 'bid');
  asks = filterBookLevels(asks, mid, 'ask');
  return {
    symbol,
    bids,
    asks,
    blockTime: n(d.blockTime),
    updateId: n(d.updateID),
    gateway: res.gateway,
    meta: meta('live', `${res.gateway === 'testnet' ? TESTNET : MAINNET}${path}`),
  };
}

export async function fetchKlines(
  symbol: string,
  interval = '1h',
  limit = 120,
): Promise<{ klines: SodexKline[]; gateway: 'testnet' | 'mainnet' | 'fallback' }> {
  const path = `/api/v1/spot/markets/${encodeURIComponent(symbol)}/klines?interval=${interval}&limit=${limit}`;
  const res = await publicFirst(path);
  if (!res.ok) return { klines: [], gateway: 'fallback' };
  const rows = Array.isArray(res.data) ? res.data : [];
  const klines = rows.map((r) => {
    const x = r as Record<string, unknown>;
    return { t: n(x.t), o: n(x.o), h: n(x.h), l: n(x.l), c: n(x.c), v: n(x.v) };
  });
  return { klines, gateway: res.gateway };
}

export async function fetchRecentTrades(symbol: string, limit = 24): Promise<SodexTradePrint[]> {
  const path = `/api/v1/spot/markets/${encodeURIComponent(symbol)}/trades?limit=${limit}`;
  const res = await publicFirst(path);
  if (!res.ok) return [];
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    const side = String(x.S ?? x.side ?? 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
    return { id: n(x.t ?? x.id), time: n(x.T ?? x.time), price: n(x.p ?? x.price), qty: n(x.q ?? x.qty), side };
  });
}

export async function fetchFundingHint(perpsSymbol = 'BTC-USD'): Promise<number | null> {
  // Best-effort; perps routes vary by deploy
  for (const path of [
    `/api/v1/perps/markets/tickers?symbol=${encodeURIComponent(perpsSymbol)}`,
    `/api/v1/perp/markets/tickers?symbol=${encodeURIComponent(perpsSymbol)}`,
  ]) {
    const res = await publicFirst(path);
    if (!res.ok) continue;
    const rows = Array.isArray(res.data) ? res.data : [];
    const row = (rows[0] ?? null) as Record<string, unknown> | null;
    if (!row) continue;
    const fr = n(row.fundingRate);
    if (Number.isFinite(fr)) return fr;
  }
  return null;
}

function mapTicker(r: Record<string, unknown>, fallbackSymbol?: string): MarketTicker {
  return {
    symbol: String(r.symbol ?? fallbackSymbol ?? ''),
    lastPrice: n(r.lastPx ?? r.lastPrice),
    changePct24h: n(r.changePct ?? r.changePct24h),
    high: n(r.highPx ?? r.high),
    low: n(r.lowPx ?? r.low),
    volume: n(r.volume ?? r.quoteVolume),
  };
}

export async function fetchTicker(
  symbol: string,
): Promise<{ ticker: MarketTicker | null; gateway: 'testnet' | 'mainnet' | 'fallback' }> {
  const path = `/api/v1/spot/markets/tickers?symbol=${encodeURIComponent(symbol)}`;
  const res = await publicFirst(path);
  if (!res.ok) return { ticker: null, gateway: 'fallback' };
  const rows = Array.isArray(res.data) ? res.data : [];
  const r = (rows[0] ?? null) as Record<string, unknown> | null;
  if (!r) return { ticker: null, gateway: res.gateway };
  return { gateway: res.gateway, ticker: mapTicker(r, symbol) };
}

export async function fetchAllTickers(): Promise<{
  tickers: MarketTicker[];
  gateway: 'testnet' | 'mainnet' | 'fallback';
}> {
  const path = `/api/v1/spot/markets/tickers`;
  const res = await publicFirst(path);
  if (!res.ok) return { tickers: [], gateway: 'fallback' };
  const rows = Array.isArray(res.data) ? res.data : [];
  const tickers = rows
    .map((row) => mapTicker(row as Record<string, unknown>))
    .filter((t) => t.symbol && t.lastPrice > 0)
    .sort((a, b) => {
      const rank = (s: string) => (/BTC/i.test(s) ? 0 : /ETH/i.test(s) ? 1 : /SOL/i.test(s) ? 2 : 9);
      const d = rank(a.symbol) - rank(b.symbol);
      return d !== 0 ? d : b.volume - a.volume;
    });
  return { tickers, gateway: res.gateway };
}

export async function fetchMarketBundle(
  symbol: string,
  interval = '1h',
): Promise<SodexMarketBundle> {
  const [tick, book, kl, trades, funding] = await Promise.all([
    fetchTicker(symbol),
    fetchOrderBook(symbol, 40),
    fetchKlines(symbol, interval, 120),
    fetchRecentTrades(symbol, 20),
    /BTC/i.test(symbol) ? fetchFundingHint('BTC-USD') : /ETH/i.test(symbol) ? fetchFundingHint('ETH-USD') : Promise.resolve(null),
  ]);
  const gateway = tick.gateway !== 'fallback' ? tick.gateway : book?.gateway ?? kl.gateway;
  const live = Boolean(tick.ticker || book || kl.klines.length);
  return {
    symbol,
    ticker: tick.ticker,
    orderbook: book,
    klines: kl.klines,
    trades,
    fundingRate: funding,
    gateway,
    meta: meta(
      live ? 'live' : 'fallback',
      `/api/v1/spot/markets/${symbol}`,
      live
        ? gateway === 'mainnet'
          ? 'Live prices (SoDEX mainnet public data)'
          : 'Live prices (SoDEX public data)'
        : 'SoDEX public market data unavailable',
    ),
  };
}
