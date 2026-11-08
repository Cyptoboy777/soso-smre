/**
 * Non-custodial SoDEX order + builder approval helpers.
 * Server prepares payloads and relays user signatures — never signs with user keys.
 *
 * Docs:
 * - https://docs.sodex.com/for-developers/developers/trading/builder-codes-in-trading.md
 * - https://docs.sodex.com/for-developers/developers/trading/authentication-and-signing.md
 */
import { keccak256, toHex, type Hex } from "viem";
import {
  assertRelayAllowed,
  assertTradingAllowed,
  buildApproveBuilderFeeTypedData,
  buildSpotExchangeTypedData,
  builderParamsFromConfig,
  getBuilderConfig,
  networkChainId,
  publicApiBase,
  spotApiBase,
  withBatchBuilder,
  type BuilderParams,
  type SodexNetworkLabel,
} from "@/lib/sodex-builder";
import { reserveNonce } from "@/lib/nonce-ledger";

const SIG_RE = /^0x[0-9a-fA-F]+$/;

export function normalizeWalletSig(sig: string, prefixByte: 1 | 2): Hex {
  let hex = sig.trim();
  if (!hex.startsWith("0x")) hex = `0x${hex}`;
  if (!SIG_RE.test(hex)) throw new Error("Invalid signature hex");
  // Strip accidental prefix if wallet already included typed prefix
  const body = hex.slice(2);
  if (body.length === 132 && (body.startsWith("01") || body.startsWith("02"))) {
    hex = `0x${body.slice(2)}`;
  }
  const recovery = Number.parseInt(hex.slice(-2), 16);
  const wire =
    hex.slice(0, -2) +
    (recovery >= 27 ? recovery - 27 : recovery).toString(16).padStart(2, "0");
  const prefixed = (`0x${prefixByte.toString(16).padStart(2, "0")}${wire.slice(2)}`) as Hex;
  return prefixed;
}

function compactSignPayload(type: string, params: Record<string, unknown>): string {
  return JSON.stringify({ type, params });
}

export function hashExchangePayload(
  type: string,
  params: Record<string, unknown>,
): Hex {
  return keccak256(toHex(compactSignPayload(type, params)));
}

/** Spot batchNewOrder params with documented field order + optional builder last. */
export function buildSpotBatchParams(input: {
  accountId: number;
  symbolId: number;
  clOrdID: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  quantity: string;
  price?: string;
  builder: BuilderParams | null;
}): Record<string, unknown> {
  const sideNum = input.side === "buy" ? 1 : 2;
  const typeNum = input.type === "limit" ? 1 : 2;
  const timeInForce = input.type === "market" ? 3 : 1;
  const order: Record<string, unknown> = {
    symbolID: input.symbolId,
    clOrdID: input.clOrdID.slice(0, 36),
    side: sideNum,
    type: typeNum,
    timeInForce,
  };
  if (input.type === "limit" && input.price) {
    order.price = String(input.price);
    order.quantity = String(input.quantity);
  } else if (input.type === "market" && input.side === "buy") {
    order.funds = String(input.quantity);
  } else {
    order.quantity = String(input.quantity);
  }
  const base: Record<string, unknown> = {
    accountID: input.accountId,
    orders: [order],
  };
  return withBatchBuilder(base, input.builder);
}

export type PreparedApproval = {
  network: SodexNetworkLabel;
  apiChain: number;
  nonce: string;
  userAddress: string;
  accountId: number;
  builderId: number;
  maxFeeRate: number;
  maxFeeLabel: string;
  typedData: ReturnType<typeof buildApproveBuilderFeeTypedData>;
  requestBody: {
    accountID: number;
    builderID: number;
    maxFeeRate: number;
  };
  endpoint: string;
};

export function prepareBuilderApproval(opts: {
  userAddress: string;
  accountId: number;
  network?: SodexNetworkLabel;
  maxFeeRate?: number;
}): PreparedApproval {
  const cfg = getBuilderConfig();
  if (!cfg.builderId) {
    throw new Error("App fee approval is not available right now");
  }
  const network = opts.network ?? cfg.network;
  const maxFeeRate = Math.min(
    opts.maxFeeRate ?? cfg.maxApproval,
    2000,
  );
  if (maxFeeRate < 0) throw new Error("maxFeeRate out of range");
  const apiChain = networkChainId(network);
  const nonce = BigInt(Date.now());
  const typedData = buildApproveBuilderFeeTypedData({
    network,
    apiChain,
    nonce,
    accountId: opts.accountId,
    builderId: cfg.builderId,
    maxFeeRate,
  });
  const userAddress = opts.userAddress.toLowerCase();
  return {
    network,
    apiChain,
    nonce: nonce.toString(),
    userAddress,
    accountId: opts.accountId,
    builderId: cfg.builderId,
    maxFeeRate,
    maxFeeLabel: `${maxFeeRate / 10} bp`,
    typedData,
    requestBody: {
      accountID: opts.accountId,
      builderID: cfg.builderId,
      maxFeeRate,
    },
    endpoint: `${publicApiBase(network)}/user/${userAddress}/builders`,
  };
}

export async function relayBuilderApproval(opts: {
  userAddress: string;
  network: SodexNetworkLabel;
  apiChain: number;
  nonce: string;
  signature: string;
  body: { accountID: number; builderID: number; maxFeeRate: number };
}): Promise<{ ok: true; raw: unknown } | { ok: false; error: string }> {
  let apiSign: Hex;
  try {
    apiSign = normalizeWalletSig(opts.signature, 2);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const url = `${publicApiBase(opts.network)}/user/${opts.userAddress.toLowerCase()}/builders`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Chain": String(opts.apiChain),
        "X-API-Sign": apiSign,
        "X-API-Nonce": opts.nonce,
      },
      body: JSON.stringify(opts.body),
      cache: "no-store",
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {
      /* keep */
    }
    if (!res.ok) {
      return { ok: false, error: `SoDEX HTTP ${res.status}: ${text.slice(0, 240)}` };
    }
    const envelope = raw as { code?: number; msg?: string };
    if (typeof envelope.code === "number" && envelope.code !== 0) {
      return {
        ok: false,
        error: `SoDEX code ${envelope.code}: ${envelope.msg ?? text.slice(0, 160)}`,
      };
    }
    return { ok: true, raw };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type PreparedOrder = {
  network: SodexNetworkLabel;
  signType: "batchNewOrder";
  params: Record<string, unknown>;
  payloadHash: Hex;
  nonce: string;
  typedData: ReturnType<typeof buildSpotExchangeTypedData>;
  endpoint: string;
  builder: BuilderParams | null;
  feeDisclosure: {
    builderId: number | null;
    feeTenthsOfBp: number | null;
    feeLabel: string;
    spotBuyNote: string;
  };
  confirmSummary: {
    symbol: string;
    side: string;
    type: string;
    quantity: string;
    price?: string;
    maxNotionalUsdc: number;
    network: SodexNetworkLabel;
    chainId: number;
    gateway: string;
  };
  dryRun: boolean;
  realFundsWarning: string | null;
  feeEngineNotes: string[];
};

export function prepareUserSpotOrder(opts: {
  network: SodexNetworkLabel;
  accountId: number;
  symbol: string;
  symbolId: number;
  side: "buy" | "sell";
  type: "limit" | "market";
  quantity: string;
  price?: string;
  clientOrderId?: string;
  confirmed: boolean;
  /** Build mainnet typed data without enabling relay (kill switch still blocks submit). */
  dryRun?: boolean;
  /** Master wallet that will sign. Used to reserve a unique nonce. */
  signingAddress?: string;
  /**
   * When false, the signed payload omits builder. Spot buys do not pay an app
   * fee either way. Never insert a fee after the user has signed.
   */
  includeBuilder?: boolean;
}): PreparedOrder {
  const dryRun = Boolean(opts.dryRun);
  const blocked = assertTradingAllowed({
    network: opts.network,
    confirmed: opts.confirmed,
    dryRun,
  });
  if (blocked) throw new Error(blocked);

  const cfg = getBuilderConfig();
  if (opts.includeBuilder && cfg.builderId == null) {
    throw new Error("App fee tagging is not available on this deployment.");
  }
  // Tag only when the user opted in before signing. Do not invent an ID.
  const builder =
    opts.includeBuilder && cfg.builderId != null
      ? builderParamsFromConfig(cfg)
      : null;

  const nonce = opts.signingAddress
    ? BigInt(reserveNonce(opts.signingAddress))
    : BigInt(Date.now());
  const clOrdID =
    opts.clientOrderId?.slice(0, 36) ??
    `fs-${nonce.toString(36)}`.slice(0, 36);

  const params = buildSpotBatchParams({
    accountId: opts.accountId,
    symbolId: opts.symbolId,
    clOrdID,
    side: opts.side,
    type: opts.type,
    quantity: opts.quantity,
    price: opts.price,
    builder,
  });
  const payloadHash = hashExchangePayload("batchNewOrder", params);
  const typedData = buildSpotExchangeTypedData({
    network: opts.network,
    payloadHash,
    nonce,
  });

  const feeEngineNotes = [
    cfg.feeDisclosure.perpsBothSides,
    cfg.feeDisclosure.spotBuyExempt,
    cfg.feeDisclosure.caps,
  ];
  if (opts.side === "buy") {
    feeEngineNotes.unshift(
      "This is a spot buy: no app fee applies on the buying side.",
    );
  } else {
    feeEngineNotes.unshift(
      "This is a spot sell: an app fee may apply up to your approval.",
    );
  }

  return {
    network: opts.network,
    signType: "batchNewOrder",
    params,
    payloadHash,
    nonce: nonce.toString(),
    typedData,
    endpoint: `${spotApiBase(opts.network)}/trade/orders/batch`,
    builder,
    feeDisclosure: {
      builderId: builder?.id ?? null,
      feeTenthsOfBp: builder?.fee ?? null,
      feeLabel: builder
        ? `Includes a ${cfg.appFeePercent} app fee`
        : "No app fee on this order",
      spotBuyNote: cfg.feeDisclosure.spotBuyExempt,
    },
    confirmSummary: {
      symbol: opts.symbol,
      side: opts.side,
      type: opts.type,
      quantity: opts.quantity,
      price: opts.price,
      maxNotionalUsdc: cfg.maxNotionalUsdc,
      network: opts.network,
      chainId: networkChainId(opts.network),
      gateway: spotApiBase(opts.network).replace(/\/api\/v1\/spot$/, ""),
    },
    dryRun,
    realFundsWarning:
      opts.network === "mainnet" ? cfg.realFundsWarning : null,
    feeEngineNotes,
  };
}

export type RelayOutcome =
  | { ok: true; raw: unknown }
  | { ok: false; error: string; raw?: unknown; venueRejected?: boolean };

/**
 * Relay a user-signed spot batch order.
 * Direct master-wallet signing omits X-API-Key. This server never creates a key.
 * Spot route only: POST /api/v1/spot/trade/orders/batch
 */
export async function relayUserSpotOrder(opts: {
  network: SodexNetworkLabel;
  params: Record<string, unknown>;
  nonce: string;
  signature: string;
  /** Optional registered API key name. Omit for master-wallet signing. */
  apiKeyName?: string;
}): Promise<RelayOutcome> {
  const blocked = assertRelayAllowed({
    network: opts.network,
    confirmed: true,
  });
  if (blocked) return { ok: false, error: blocked };

  let apiSign: Hex;
  try {
    apiSign = normalizeWalletSig(opts.signature, 1);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Sign": apiSign,
    "X-API-Nonce": opts.nonce,
  };
  if (opts.apiKeyName?.trim()) {
    headers["X-API-Key"] = opts.apiKeyName.trim();
  }

  const url = `${spotApiBase(opts.network)}/trade/orders/batch`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(opts.params),
      cache: "no-store",
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {
      /* keep */
    }
    if (!res.ok) {
      return { ok: false, error: "The trading network did not accept that request." };
    }
    const envelope = raw as { code?: number };
    if (typeof envelope.code === "number" && envelope.code !== 0) {
      return {
        ok: false,
        venueRejected: true,
        raw,
        error: "The exchange rejected the request.",
      };
    }
    return { ok: true, raw };
  } catch {
    return { ok: false, error: "The trading network did not accept that request." };
  }
}

export function buildSpotCancelParams(input: {
  accountId: number;
  symbolId: number;
  orderId: string;
  origClOrdID?: string;
  cancelClientId: string;
}): Record<string, unknown> {
  if (!/^[1-9]\d*$/.test(input.orderId)) {
    throw new Error("That order id cannot be cancelled from here.");
  }
  const orderID = Number(input.orderId);
  if (!Number.isSafeInteger(orderID)) {
    throw new Error("That order id cannot be cancelled from here.");
  }
  const item: Record<string, unknown> = {
    symbolID: input.symbolId,
    clOrdID: input.cancelClientId.slice(0, 36),
    orderID,
  };
  if (input.origClOrdID && /^[0-9a-zA-Z_-]{1,36}$/.test(input.origClOrdID)) {
    item.origClOrdID = input.origClOrdID;
  }
  return { accountID: input.accountId, cancels: [item] };
}

/** User-signed spot cancel on DELETE /api/v1/spot/trade/orders/batch. */
export function prepareUserSpotCancel(opts: {
  network: SodexNetworkLabel;
  accountId: number;
  symbolId: number;
  orderId: string;
  origClOrdID?: string;
  signingAddress: string;
  confirmed: boolean;
}): {
  network: SodexNetworkLabel;
  signType: "batchCancelOrder";
  params: Record<string, unknown>;
  payloadHash: Hex;
  nonce: string;
  typedData: ReturnType<typeof buildSpotExchangeTypedData>;
} {
  const blocked = assertTradingAllowed({
    network: opts.network,
    confirmed: opts.confirmed,
  });
  if (blocked) throw new Error(blocked);
  const nonce = BigInt(reserveNonce(opts.signingAddress));
  const params = buildSpotCancelParams({
    accountId: opts.accountId,
    symbolId: opts.symbolId,
    orderId: opts.orderId,
    origClOrdID: opts.origClOrdID,
    cancelClientId: `cxl-${nonce.toString(36)}`.slice(0, 36),
  });
  const payloadHash = hashExchangePayload("batchCancelOrder", params);
  return {
    network: opts.network,
    signType: "batchCancelOrder",
    params,
    payloadHash,
    nonce: nonce.toString(),
    typedData: buildSpotExchangeTypedData({
      network: opts.network,
      payloadHash,
      nonce,
    }),
  };
}

export async function relayUserSpotCancel(opts: {
  network: SodexNetworkLabel;
  params: Record<string, unknown>;
  nonce: string;
  signature: string;
}): Promise<RelayOutcome> {
  const blocked = assertRelayAllowed({ network: opts.network, confirmed: true });
  if (blocked) return { ok: false, error: blocked };
  let apiSign: Hex;
  try {
    apiSign = normalizeWalletSig(opts.signature, 1);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const res = await fetch(`${spotApiBase(opts.network)}/trade/orders/batch`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Sign": apiSign,
        "X-API-Nonce": opts.nonce,
      },
      body: JSON.stringify(opts.params),
      cache: "no-store",
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {
      /* keep */
    }
    if (!res.ok) return { ok: false, error: "The trading network did not accept that request." };
    const envelope = raw as { code?: number };
    if (typeof envelope.code === "number" && envelope.code !== 0) {
      return { ok: false, venueRejected: true, raw, error: "The exchange rejected the cancel." };
    }
    return { ok: true, raw };
  } catch {
    return { ok: false, error: "The trading network did not accept that request." };
  }
}

export async function fetchPrimaryAccountId(
  network: SodexNetworkLabel,
  userAddress: string,
): Promise<number | null> {
  const url = `${publicApiBase(network)}/user/${userAddress.toLowerCase()}/subaccounts`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    code?: number;
    data?: { primaryAccountID?: number | string; aid?: number | string };
  };
  if (typeof body.code === "number" && body.code !== 0) return null;
  const id = body.data?.primaryAccountID ?? body.data?.aid;
  const n = typeof id === "number" ? id : Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

export async function fetchUserBuilders(
  network: SodexNetworkLabel,
  userAddress: string,
): Promise<unknown> {
  const url = `${publicApiBase(network)}/user/${userAddress.toLowerCase()}/builders`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) };
  }
}

/** Resolve spot symbol id on the selected network (public markets endpoint). */
export async function resolveSymbolIdOnNetwork(
  network: SodexNetworkLabel,
  symbol: string,
): Promise<number | null> {
  const url = `${spotApiBase(network)}/markets/symbols`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    code?: number;
    data?: Array<{ id?: number; name?: string; displayName?: string }> | {
      list?: Array<{ id?: number; name?: string; displayName?: string }>;
    };
  };
  if (typeof body.code === "number" && body.code !== 0) return null;
  const rows = Array.isArray(body.data)
    ? body.data
    : body.data && Array.isArray(body.data.list)
      ? body.data.list
      : [];
  const want = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const hit = rows.find((s) => {
    const name = (s.name ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const display = (s.displayName ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return name.includes(want) || display.includes(want) || want.includes(name);
  });
  const id = hit?.id;
  return typeof id === "number" && Number.isSafeInteger(id) ? id : null;
}
