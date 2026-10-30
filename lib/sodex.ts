/**
 * SoDEX testnet client — EIP-712 signed spot orders.
 * Hard-locked to testnet (chainId 138565). No mainnet path.
 *
 * Auth (official docs):
 * - X-API-Key = registered key *name* (not address / not private key)
 * - X-API-Sign = 0x01 || EIP-712(ExchangeAction{payloadHash, nonce})
 * - X-API-Nonce = ms timestamp (unique per signing address)
 * - Domain: { name: "spot", version: "1", chainId: 138565, verifyingContract: zero }
 * - payloadHash = keccak256(compact JSON of { type, params })
 *
 * Docs: https://sodex.com/documentation/for-developers/developers/trading/authentication-and-signing
 * SDK ref: https://github.com/sodex-tech/sodex-python-sdk-public
 */

import { concatHex, keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  MarketPanel,
  MarketTicker,
  OrderRequest,
  OrderResult,
  SourceMeta,
} from "@/types/flow";

/** Hard-locked testnet only. */
export const SODEX_TESTNET = {
  baseUrl: "https://testnet-gw.sodex.dev",
  chainId: 138565,
  domainName: "spot" as const,
  verifyingContract:
    "0x0000000000000000000000000000000000000000" as const,
} as const;

const ZERO = SODEX_TESTNET.verifyingContract;

export type SodexEnv = "testnet";

export type SodexCredentials = {
  accountId: number;
  apiKeyName: string;
  /** 0x-prefixed private key of the *API-key wallet* (not the master). */
  apiKeyPrivateKey: Hex;
};

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market";

export type PlaceOrderInput = {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  clientOrderId?: string;
};

export type PlaceOrderResult =
  | {
      ok: true;
      dryRun: false;
      orderId: string;
      clientOrderId: string;
      status: string;
      raw: unknown;
      env: SodexEnv;
    }
  | {
      ok: true;
      dryRun: true;
      orderId: string;
      clientOrderId: string;
      status: "dry-run";
      note: string;
      env: SodexEnv;
      signedPreview?: {
        payloadHash: Hex;
        nonce: string;
        apiKeyName: string;
        accountId: number;
      };
    }
  | { ok: false; error: string; dryRun: boolean; env: SodexEnv };

type SpotSymbol = {
  id: number;
  name: string;
  displayName?: string;
  status?: string;
};

function requireTestnetOnly(url: string | undefined): string {
  const u = (url ?? SODEX_TESTNET.baseUrl).replace(/\/$/, "");
  if (/mainnet/i.test(u) || u.includes("mainnet-gw")) {
    throw new Error(
      "SoDEX mainnet is hard-locked out. FlowSentinel only talks to testnet-gw.sodex.dev.",
    );
  }
  if (!u.includes("testnet")) {
    // Force testnet even if someone overrides with a weird host.
    return SODEX_TESTNET.baseUrl;
  }
  return u;
}

export function getSodexCredentials(): SodexCredentials | null {
  const accountIdRaw = process.env.SODEX_ACCOUNT_ID?.trim();
  const apiKeyName = process.env.SODEX_API_KEY_NAME?.trim();
  const pk = process.env.SODEX_API_KEY_PRIVATE_KEY?.trim();
  if (!accountIdRaw || !apiKeyName || !pk) return null;
  const accountId = Number(accountIdRaw);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) return null;
  const hex = (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) return null;
  return { accountId, apiKeyName, apiKeyPrivateKey: hex };
}

/** True when EIP-712 testnet credentials are present. */
export function hasSodexCredentials(): boolean {
  return getSodexCredentials() !== null;
}

/** @deprecated alias — prefer hasSodexCredentials */
export function hasSodexKeys(): boolean {
  return hasSodexCredentials();
}


function sourceMeta(source: SourceMeta["source"], endpoint?: string, note?: string): SourceMeta {
  return { source, endpoint, fetchedAt: new Date().toISOString(), note };
}

function fallbackMarket(): MarketPanel {
  return {
    tickers: [
      { symbol: "vBTC_vUSDC", lastPrice: 95_000, changePct24h: 1.2, high: 96_200, low: 93_800, volume: 120 },
      { symbol: "vETH_vUSDC", lastPrice: 3_450, changePct24h: 0.8, high: 3_510, low: 3_380, volume: 800 },
    ],
    meta: sourceMeta("fallback", "/markets/tickers", "Illustrative sample — SoDEX public tickers unavailable"),
  };
}

function num(r: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
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

  const wanted = new Set(["vBTC_vUSDC", "vETH_vUSDC", "BTC_USDC", "ETH_USDC"]);
  const tickers: MarketTicker[] = rows
    .map((r) => {
      const symbol = String(r.symbol ?? r.s ?? r.name ?? "");
      return {
        symbol,
        lastPrice: num(r, "lastPx", "lastPrice", "c", "price"),
        changePct24h: num(r, "changePct", "priceChangePercent", "P"),
        high: num(r, "highPx", "highPrice", "h"),
        low: num(r, "lowPx", "lowPrice", "l"),
        volume: num(r, "volume", "v"),
      };
    })
    .filter((t) => t.symbol && (wanted.has(t.symbol) || /BTC|ETH/i.test(t.symbol)))
    .slice(0, 6);

  if (!tickers.length) {
    const fb = fallbackMarket();
    fb.meta.note = "SoDEX returned no BTC/ETH tickers — labelled fallback.";
    return fb;
  }
  return { tickers, meta: sourceMeta("live", endpoint) };
}

/** Public spot tickers from SoDEX *testnet only* (no mainnet fallback). */
export async function fetchSpotTickers(): Promise<MarketPanel> {
  const path = "/api/v1/spot/markets/tickers";
  const base = requireTestnetOnly(process.env.SODEX_BASE_URL);
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      const fb = fallbackMarket();
      fb.meta.note = `SoDEX testnet tickers HTTP ${res.status} — labelled fallback.`;
      return fb;
    }
    return parseTickers(await res.json(), `${base}${path}`);
  } catch (e) {
    const fb = fallbackMarket();
    fb.meta.note = `SoDEX fetch error (${e instanceof Error ? e.message : String(e)}) — labelled fallback.`;
    return fb;
  }
}

export function pickPrice(market: MarketPanel, symbol: string): number {
  const t = market.tickers.find(
    (x) =>
      x.symbol === symbol ||
      x.symbol.includes(symbol.replace("v", "").split("_")[0] ?? ""),
  );
  if (t?.lastPrice) return t.lastPrice;
  if (/BTC/i.test(symbol))
    return market.tickers.find((x) => /BTC/i.test(x.symbol))?.lastPrice ?? 95_000;
  if (/ETH/i.test(symbol))
    return market.tickers.find((x) => /ETH/i.test(x.symbol))?.lastPrice ?? 3_450;
  return market.tickers[0]?.lastPrice ?? 1;
}

async function publicGet<T>(path: string): Promise<T> {
  const base = requireTestnetOnly(process.env.SODEX_BASE_URL);
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`SoDEX ${path} → HTTP ${res.status}`);
  const body = (await res.json()) as { code?: number; data?: T; msg?: string };
  if (typeof body.code === "number" && body.code !== 0) {
    throw new Error(`SoDEX ${path} → code ${body.code}: ${body.msg ?? "?"}`);
  }
  return (body.data ?? body) as T;
}

export async function listSpotSymbols(): Promise<SpotSymbol[]> {
  const data = await publicGet<SpotSymbol[] | { list?: SpotSymbol[] }>(
    "/api/v1/spot/markets/symbols",
  );
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.list)) return data.list;
  return [];
}

export async function resolveSymbolId(symbol: string): Promise<number | null> {
  const symbols = await listSpotSymbols();
  const want = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const hit = symbols.find((s) => {
    const name = (s.name ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const display = (s.displayName ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return name.includes(want) || display.includes(want) || want.includes(name);
  });
  return hit?.id ?? null;
}

/**
 * Compact JSON for payloadHash — JSON.stringify with no whitespace.
 * Key order MUST match Go struct field order (see schema BatchNewOrder*).
 */
function compactSignPayload(type: string, params: Record<string, unknown>): string {
  return JSON.stringify({ type, params });
}

/**
 * Build spot BatchNewOrder params with Go-struct field order:
 * accountID, orders[{symbolID, clOrdID, side, type, timeInForce, price?, quantity?, funds?}]
 */
function buildSpotNewOrderParams(input: {
  accountId: number;
  symbolId: number;
  clOrdID: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
}): Record<string, unknown> {
  const sideNum = input.side === "buy" ? 1 : 2;
  const typeNum = input.type === "limit" ? 1 : 2;
  const timeInForce = 1; // GTC
  const order: Record<string, unknown> = {
    symbolID: input.symbolId,
    clOrdID: input.clOrdID,
    side: sideNum,
    type: typeNum,
    timeInForce,
  };
  if (input.type === "limit" && input.price) {
    order.price = String(input.price);
    order.quantity = String(input.quantity);
  } else if (input.type === "market" && input.side === "buy") {
    // Market buy uses funds (quote). Callers should pass quantity as quote notional.
    order.funds = String(input.quantity);
  } else {
    order.quantity = String(input.quantity);
  }
  return {
    accountID: input.accountId,
    orders: [order],
  };
}

async function signExchangeAction(opts: {
  privateKey: Hex;
  payloadHash: Hex;
  nonce: bigint;
}): Promise<Hex> {
  const account = privateKeyToAccount(opts.privateKey);
  const signature = await account.signTypedData({
    domain: {
      name: SODEX_TESTNET.domainName,
      version: "1",
      chainId: SODEX_TESTNET.chainId,
      verifyingContract: ZERO,
    },
    types: {
      ExchangeAction: [
        { name: "payloadHash", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "ExchangeAction",
    message: {
      payloadHash: opts.payloadHash,
      nonce: opts.nonce,
    },
  });
  // Typed signature: prepend 0x01
  return concatHex(["0x01", signature]);
}

/**
 * Place a spot order on SoDEX *testnet* with EIP-712 signing.
 * Without credentials → labelled dry-run (no HTTP write).
 * Never routes to mainnet.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const env: SodexEnv = "testnet";
  const creds = getSodexCredentials();
  const clientOrderId =
    input.clientOrderId ??
    `fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (!creds) {
    return {
      ok: true,
      dryRun: true,
      orderId: `dry-${clientOrderId}`,
      clientOrderId,
      status: "dry-run",
      note:
        "DRY-RUN (no live order). Set SODEX_ACCOUNT_ID + SODEX_API_KEY_NAME + SODEX_API_KEY_PRIVATE_KEY for SoDEX testnet EIP-712 signing. No mainnet path; never share fund keys.",
      env,
    };
  }

  let symbolId: number | null = null;
  try {
    symbolId = await resolveSymbolId(input.symbol);
  } catch (e) {
    return {
      ok: false,
      dryRun: false,
      error: `symbol resolve failed: ${e instanceof Error ? e.message : String(e)}`,
      env,
    };
  }
  if (symbolId == null) {
    return {
      ok: false,
      dryRun: false,
      error: `Unknown spot symbol on testnet: ${input.symbol}`,
      env,
    };
  }

  const params = buildSpotNewOrderParams({
    accountId: creds.accountId,
    symbolId,
    clOrdID: clientOrderId.slice(0, 36),
    side: input.side,
    type: input.type,
    quantity: input.quantity,
    price: input.price,
  });

  const nonce = BigInt(Date.now());
  const compact = compactSignPayload("batchNewOrder", params);
  const payloadHash = keccak256(toHex(compact));

  let apiSign: Hex;
  try {
    apiSign = await signExchangeAction({
      privateKey: creds.apiKeyPrivateKey,
      payloadHash,
      nonce,
    });
  } catch (e) {
    return {
      ok: false,
      dryRun: false,
      error: `EIP-712 sign failed: ${e instanceof Error ? e.message : String(e)}`,
      env,
    };
  }

  const base = requireTestnetOnly(process.env.SODEX_BASE_URL);
  try {
    const res = await fetch(`${base}/api/v1/spot/trade/orders/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": creds.apiKeyName,
        "X-API-Sign": apiSign,
        "X-API-Nonce": nonce.toString(),
      },
      body: JSON.stringify(params),
      cache: "no-store",
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {
      /* keep text */
    }
    if (!res.ok) {
      return {
        ok: false,
        dryRun: false,
        error: `SoDEX HTTP ${res.status}: ${text.slice(0, 240)}`,
        env,
      };
    }
    const envelope = raw as { code?: number; msg?: string; data?: unknown };
    if (typeof envelope.code === "number" && envelope.code !== 0) {
      return {
        ok: false,
        dryRun: false,
        error: `SoDEX code ${envelope.code}: ${envelope.msg ?? text.slice(0, 160)}`,
        env,
      };
    }
    const data = envelope.data as
      | { orderId?: string | number; orderID?: string | number; status?: string }
      | Array<{ orderId?: string | number; orderID?: string | number }>
      | undefined;
    const first = Array.isArray(data) ? data[0] : data;
    const orderId = String(
      first?.orderId ?? first?.orderID ?? clientOrderId,
    );
    return {
      ok: true,
      dryRun: false,
      orderId,
      clientOrderId,
      status: (first as { status?: string } | undefined)?.status ?? "submitted",
      raw,
      env,
    };
  } catch (e) {
    return {
      ok: false,
      dryRun: false,
      error: e instanceof Error ? e.message : String(e),
      env,
    };
  }
}

/** Preview a signed payload without submitting (for UI / dry-run with keys). */
export async function previewSignedOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const env: SodexEnv = "testnet";
  const creds = getSodexCredentials();
  const clientOrderId =
    input.clientOrderId ??
    `fs-prev-${Date.now().toString(36)}`;
  if (!creds) {
    return placeOrder(input); // falls into dry-run
  }
  let symbolId: number | null = null;
  try {
    symbolId = await resolveSymbolId(input.symbol);
  } catch {
    symbolId = null;
  }
  const params = buildSpotNewOrderParams({
    accountId: creds.accountId,
    symbolId: symbolId ?? 1,
    clOrdID: clientOrderId.slice(0, 36),
    side: input.side,
    type: input.type,
    quantity: input.quantity,
    price: input.price,
  });
  const nonce = BigInt(Date.now());
  const payloadHash = keccak256(toHex(compactSignPayload("batchNewOrder", params)));
  return {
    ok: true,
    dryRun: true,
    orderId: `dry-${clientOrderId}`,
    clientOrderId,
    status: "dry-run",
    note:
      "DRY-RUN preview — EIP-712 payload hashed locally; nothing submitted to SoDEX. Confirm on desk to submit on testnet only.",
    env,
    signedPreview: {
      payloadHash,
      nonce: nonce.toString(),
      apiKeyName: creds.apiKeyName,
      accountId: creds.accountId,
    },
  };
}


/**
 * Desk-facing limit order. Returns OrderResult.
 * Without EIP-712 testnet credentials → clearly labelled DRY-RUN (no HTTP write).
 * Hard-locked to SoDEX testnet.
 */
export async function placeLimitOrder(req: OrderRequest): Promise<OrderResult> {
  if (!req.confirmed) {
    return {
      mode: "dry-run",
      orderId: `blocked-${Date.now()}`,
      status: "rejected",
      symbol: req.symbol,
      side: req.side,
      price: req.price,
      quantity: req.quantity,
      submittedAt: new Date().toISOString(),
      note: "Order not confirmed — DRY-RUN only; nothing submitted.",
    };
  }
  const result = await placeOrder({
    symbol: req.symbol,
    side: req.side === "BUY" ? "buy" : "sell",
    type: "limit",
    quantity: String(req.quantity),
    price: String(req.price),
    clientOrderId: `fs-${req.thesisId}`.slice(0, 36),
  });
  if (!result.ok) {
    return {
      mode: "dry-run",
      orderId: `err-${Date.now()}`,
      status: "error",
      symbol: req.symbol,
      side: req.side,
      price: req.price,
      quantity: req.quantity,
      submittedAt: new Date().toISOString(),
      note: `DRY-RUN / blocked: ${result.error}`,
    };
  }
  return {
    mode: result.dryRun ? "dry-run" : "live",
    orderId: result.orderId,
    status: result.status,
    symbol: req.symbol,
    side: req.side,
    price: req.price,
    quantity: req.quantity,
    submittedAt: new Date().toISOString(),
    note: result.dryRun
      ? ("note" in result
          ? result.note
          : "DRY-RUN — no SoDEX testnet credentials; nothing submitted.")
      : `Submitted to SoDEX testnet (chainId ${SODEX_TESTNET.chainId}).`,
  };
}
