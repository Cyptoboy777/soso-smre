/**
 * SoDEX public market data + dry-run / signed-order placement helpers.
 * Testnet REST: https://testnet-gw.sodex.dev/api/v1/spot
 * Writes require EIP-712 signing with SODEX_* env keys; without keys we dry-run.
 */
import type { MarketPanel, MarketTicker, OrderRequest, OrderResult, SourceMeta } from '@/types/flow';
import crypto from 'crypto';

export const SODEX_TESTNET_SPOT = 'https://testnet-gw.sodex.dev/api/v1/spot';
export const SODEX_MAINNET_SPOT = 'https://mainnet-gw.sodex.dev/api/v1/spot';

export function hasSodexKeys(): boolean {
  return Boolean(
    process.env.SODEX_API_KEY?.trim() &&
      process.env.SODEX_API_SECRET?.trim(),
  );
}

function meta(source: SourceMeta['source'], endpoint?: string, note?: string): SourceMeta {
  return { source, endpoint, fetchedAt: new Date().toISOString(), note };
}

function fallbackMarket(): MarketPanel {
  return {
    tickers: [
      { symbol: 'vBTC_vUSDC', lastPrice: 95_000, changePct24h: 1.2, high: 96_200, low: 93_800, volume: 120 },
      { symbol: 'vETH_vUSDC', lastPrice: 3_450, changePct24h: 0.8, high: 3_510, low: 3_380, volume: 800 },
    ],
    meta: meta('fallback', '/markets/tickers', 'Illustrative sample — SoDEX public tickers unavailable'),
  };
}

export async function fetchSpotTickers(): Promise<MarketPanel> {
  const path = '/markets/tickers';
  try {
    const res = await fetch(`${SODEX_TESTNET_SPOT}${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      // try mainnet public as secondary live source
      const main = await fetch(`${SODEX_MAINNET_SPOT}${path}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!main.ok) {
        const fb = fallbackMarket();
        fb.meta.note = `SoDEX tickers HTTP ${res.status}/${main.status} — labelled fallback.`;
        return fb;
      }
      return parseTickers(await main.json(), `${SODEX_MAINNET_SPOT}${path}`);
    }
    return parseTickers(await res.json(), `${SODEX_TESTNET_SPOT}${path}`);
  } catch (e) {
    const fb = fallbackMarket();
    fb.meta.note = `SoDEX fetch error (${e instanceof Error ? e.message : String(e)}) — labelled fallback.`;
    return fb;
  }
}


function num(r: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === '') continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseTickers(body: unknown, endpoint: string): MarketPanel {
  const data = body as {
    code?: number;
    data?: Array<Record<string, unknown>> | { list?: Array<Record<string, unknown>> };
  };
  let rows: Array<Record<string, unknown>> = [];
  if (Array.isArray(data.data)) rows = data.data;
  else if (data.data && Array.isArray((data.data as { list?: unknown[] }).list)) {
    rows = (data.data as { list: Array<Record<string, unknown>> }).list;
  } else if (Array.isArray(body)) rows = body as Array<Record<string, unknown>>;

  const wanted = new Set(['vBTC_vUSDC', 'vETH_vUSDC', 'BTC_USDC', 'ETH_USDC']);
  const tickers: MarketTicker[] = rows
    .map((r) => {
      const symbol = String(r.symbol ?? r.s ?? '');
      return {
        symbol,
        lastPrice: num(r, 'lastPx', 'lastPrice', 'c', 'price'),
        changePct24h: num(r, 'changePct', 'priceChangePercent', 'P'),
        high: num(r, 'highPx', 'highPrice', 'h'),
        low: num(r, 'lowPx', 'lowPrice', 'l'),
        volume: num(r, 'volume', 'v'),
      };
    })
    .filter((t) => t.symbol && (wanted.has(t.symbol) || /BTC|ETH/i.test(t.symbol)))
    .slice(0, 6);

  if (!tickers.length) {
    const fb = fallbackMarket();
    fb.meta.note = 'SoDEX returned no BTC/ETH tickers — labelled fallback.';
    return fb;
  }

  return { tickers, meta: meta('live', endpoint) };
}

/**
 * Place a limit order on SoDEX testnet when keys exist.
 * Without keys: honest dry-run with a synthetic order id.
 *
 * Note: SoDEX writes are EIP-712 signed. When SODEX_API_KEY + SODEX_API_SECRET
 * are present we attempt a signed REST place; if the signing shape is rejected
 * we still return an explicit failure (never fake a fill).
 */
export async function placeLimitOrder(req: OrderRequest): Promise<OrderResult> {
  const submittedAt = new Date().toISOString();
  if (!req.confirmed) {
    return {
      mode: 'dry-run',
      orderId: 'unconfirmed',
      status: 'rejected',
      symbol: req.symbol,
      side: req.side,
      price: req.price,
      quantity: req.quantity,
      submittedAt,
      note: 'Explicit user confirmation required before any order.',
    };
  }

  if (!hasSodexKeys()) {
    const orderId = `dry_${crypto.randomBytes(6).toString('hex')}`;
    return {
      mode: 'dry-run',
      orderId,
      status: 'simulated',
      symbol: req.symbol,
      side: req.side,
      price: req.price,
      quantity: req.quantity,
      submittedAt,
      note: 'DRY-RUN — SODEX_API_KEY / SODEX_API_SECRET not set. No order sent to SoDEX.',
    };
  }

  // Keys present: attempt testnet place. SoDEX expects EIP-712; we send a best-effort
  // authenticated request. Failures are surfaced honestly.
  const apiKey = process.env.SODEX_API_KEY!.trim();
  const apiSecret = process.env.SODEX_API_SECRET!.trim();
  const nonce = Date.now().toString();
  const body = {
    symbol: req.symbol,
    side: req.side === 'BUY' ? 'BUY' : 'SELL',
    type: 'LIMIT',
    timeInForce: 'GTC',
    price: String(req.price),
    quantity: String(req.quantity),
    clientOrderId: `fs_${nonce}`,
  };

  // HMAC of compact body as a transport authenticator when the gateway accepts API-key mode.
  // If the venue requires EIP-712 only, the response will say so and we report failure.
  const payload = JSON.stringify(body);
  const sign = crypto.createHmac('sha256', apiSecret).update(`${nonce}${payload}`).digest('hex');

  try {
    const res = await fetch(`${SODEX_TESTNET_SPOT}/orders`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Nonce': nonce,
        'X-API-Sign': sign,
      },
      body: payload,
    });
    const text = await res.text();
    let parsed: { code?: number; data?: { orderId?: string; id?: string; status?: string }; error?: string; message?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep empty */
    }

    if (!res.ok || (parsed.code !== undefined && parsed.code !== 0)) {
      return {
        mode: 'live',
        orderId: 'failed',
        status: 'rejected',
        symbol: req.symbol,
        side: req.side,
        price: req.price,
        quantity: req.quantity,
        submittedAt,
        note: `SoDEX rejected order: HTTP ${res.status} ${parsed.error || parsed.message || text.slice(0, 200)}. Keys are set but signing may need EIP-712 agent wallet.`,
      };
    }

    const orderId = String(parsed.data?.orderId ?? parsed.data?.id ?? `sodex_${nonce}`);
    return {
      mode: 'live',
      orderId,
      status: String(parsed.data?.status ?? 'submitted'),
      symbol: req.symbol,
      side: req.side,
      price: req.price,
      quantity: req.quantity,
      submittedAt,
      note: 'Submitted to SoDEX testnet.',
    };
  } catch (e) {
    return {
      mode: 'live',
      orderId: 'error',
      status: 'error',
      symbol: req.symbol,
      side: req.side,
      price: req.price,
      quantity: req.quantity,
      submittedAt,
      note: `SoDEX request failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export function pickPrice(market: MarketPanel, symbol: string): number {
  const t = market.tickers.find((x) => x.symbol === symbol || x.symbol.includes(symbol.replace('v', '').split('_')[0] ?? ''));
  if (t?.lastPrice) return t.lastPrice;
  if (/BTC/i.test(symbol)) return market.tickers.find((x) => /BTC/i.test(x.symbol))?.lastPrice ?? 95_000;
  if (/ETH/i.test(symbol)) return market.tickers.find((x) => /ETH/i.test(x.symbol))?.lastPrice ?? 3_450;
  return market.tickers[0]?.lastPrice ?? 1;
}
