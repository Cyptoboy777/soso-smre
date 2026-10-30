/**
 * Public SoDEX market data (no API keys).
 * Prefer testnet-gw; fall back to mainnet-gw for public reads only.
 * Order signing remains testnet-only in lib/sodex.ts.
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
      next: { revalidate: 15 },
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

/** Try testnet then mainnet for unsigned public GETs. */
async function publicFirst(path: string) {
  const a = await getJson(TESTNET, path);
  if (a.ok) return { ...a, gateway: 'testnet' as const };
  const b = await getJson(MAINNET, path);
  if (b.ok) return { ...b, gateway: 'mainnet' as const };
  return { ok: false as const, error: `${a.error}; mainnet: ${b.error}`, gateway: 'fallback' as const };
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

export async function fetchOrderBook(symbol: string, limit = 20): Promise<SodexOrderBook | null> {
  const path = `/api/v1/spot/markets/${encodeURIComponent(symbol)}/orderbook?limit=${limit}`;
  const res = await publicFirst(path);
  if (!res.ok) return null;
  const d = res.data as {
    bids?: unknown;
    asks?: unknown;
    blockTime?: number;
    updateID?: number;
  };
  return {
    symbol,
    bids: mapLevels(d.bids),
    asks: mapLevels(d.asks),
    blockTime: n(d.blockTime),
    updateId: n(d.updateID),
    gateway: res.gateway,
    meta: meta('live', `${res.gateway === 'testnet' ? TESTNET : MAINNET}${path}`),
  };
}

export async function fetchKlines(
  symbol: string,
  interval = '1h',
  limit = 48,
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
  const path = `/api/v1/perps/markets/tickers?symbol=${encodeURIComponent(perpsSymbol)}`;
  const res = await publicFirst(path);
  if (!res.ok) return null;
  const rows = Array.isArray(res.data) ? res.data : [];
  const row = (rows[0] ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  const fr = n(row.fundingRate);
  return Number.isFinite(fr) ? fr : null;
}

export async function fetchTicker(symbol: string): Promise<{ ticker: MarketTicker | null; gateway: 'testnet' | 'mainnet' | 'fallback' }> {
  const path = `/api/v1/spot/markets/tickers?symbol=${encodeURIComponent(symbol)}`;
  const res = await publicFirst(path);
  if (!res.ok) return { ticker: null, gateway: 'fallback' };
  const rows = Array.isArray(res.data) ? res.data : [];
  const r = (rows[0] ?? null) as Record<string, unknown> | null;
  if (!r) return { ticker: null, gateway: res.gateway };
  return {
    gateway: res.gateway,
    ticker: {
      symbol: String(r.symbol ?? symbol),
      lastPrice: n(r.lastPx),
      changePct24h: n(r.changePct),
      high: n(r.highPx),
      low: n(r.lowPx),
      volume: n(r.volume),
    },
  };
}

export async function fetchMarketBundle(symbol: string): Promise<SodexMarketBundle> {
  const [tick, book, kl, trades, funding] = await Promise.all([
    fetchTicker(symbol),
    fetchOrderBook(symbol, 24),
    fetchKlines(symbol, '1h', 48),
    fetchRecentTrades(symbol, 20),
    /BTC/i.test(symbol) ? fetchFundingHint('BTC-USD') : fetchFundingHint('ETH-USD'),
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
      live ? undefined : 'SoDEX public market data unavailable — charts will soft-empty',
    ),
  };
}
