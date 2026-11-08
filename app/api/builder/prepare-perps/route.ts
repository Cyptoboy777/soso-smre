import { NextResponse } from "next/server";
import { getBuilderConfig, publicApiBase, buildSpotExchangeTypedData, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { resolveSymbolIdOnNetwork } from "@/lib/sodex-wallet-trade";
import { futuresTypedData } from "@/lib/sodex-perps-order";
import {
  bracketOrders,
  cancelTwapParams,
  dcaParams,
  normalPerpsOrder,
  optionalPerpsBuilder,
  perpsCancelParams,
  perpsModifyStopParams,
  perpsNewOrderParams,
  perpsReplaceParams,
  reduceOnlyStop,
  twapParams,
  hashAction,
} from "@/lib/sodex-perps-order";
import { claimPreparedNonce } from "@/lib/nonce-policy";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { jsonPublicError, logServerError } from "@/lib/public-errors";
import { isAllowedTradeSymbol } from "@/lib/trade-guard";

export const dynamic = "force-dynamic";

const PERPS_SYMBOLS = new Set(["BTC-USD", "ETH-USD"]);

async function perpsSymbolId(network: SodexNetworkLabel, symbol: string): Promise<number | null> {
  if (!PERPS_SYMBOLS.has(symbol)) return null;
  const res = await fetch(`${publicApiBase(network)}/perps/markets/symbols?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { code?: number; data?: Array<{ id?: number; name?: string }> | { list?: Array<{ id?: number; name?: string }> } };
  if (typeof body.code === "number" && body.code !== 0) return null;
  const rows = Array.isArray(body.data) ? body.data : body.data?.list ?? [];
  const hit = rows.find((row) => row.name === symbol);
  return typeof hit?.id === "number" && Number.isSafeInteger(hit.id) ? hit.id : null;
}

export async function POST(req: Request) {
  const limited = rejectIfRateLimited(`builder-perps-prep:${clientIp(req)}`, 30, 60 * 60_000, "Too many requests. Please wait a minute and try again.");
  if (limited) return limited;
  const parsed = await readJsonBodyLimited(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 413 });
  const body = parsed.value as Record<string, unknown>;
  if (body.confirmed !== true) return NextResponse.json({ error: "Please confirm the details before continuing." }, { status: 400 });
  const userAddress = String(body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) return NextResponse.json({ error: "Connect a valid wallet to continue." }, { status: 400 });
  const nonce = String(body.nonce ?? "");
  if (!/^[0-9]+$/.test(nonce)) return NextResponse.json({ error: "Reserve a signing nonce in this browser before preparing the order." }, { status: 400 });
  const accountId = Number(body.accountId);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) return NextResponse.json({ error: "Your trading account is not ready yet." }, { status: 400 });
  const cfg = getBuilderConfig();
  const network: SodexNetworkLabel = "mainnet";
  const claimed = claimPreparedNonce({ network, signingAddress: userAddress, nonce });
  if (!claimed.ok) return NextResponse.json({ error: claimed.error }, { status: 409 });
  const market = body.market === "spot" ? "spot" : "perps";
  const action = String(body.action ?? "order");
  try {
    const symbol = String(body.symbol ?? "").trim();
    const symbolId = market === "spot" ? await resolveSymbolIdOnNetwork(network, symbol) : await perpsSymbolId(network, symbol);
    if (symbolId == null || (market === "spot" && !isAllowedTradeSymbol(symbol))) {
      return NextResponse.json({ error: "That market is not available right now." }, { status: 400 });
    }
    const side = body.side === "sell" ? "sell" : "buy";
    const type = body.type === "market" ? "market" : "limit";
    const id = `p${nonce}`.slice(0, 36);
    let signType = "newOrder";
    let params: Record<string, unknown>;
    if (action === "twap") {
      signType = "newTwapOrder";
      params = twapParams({ accountId, symbolId, side, quantity: String(body.quantity ?? ""), minutes: Number(body.minutes), reduceOnly: body.reduceOnly === true });
    } else if (action === "dca") {
      signType = "newDcaOrder";
      params = dcaParams({ accountId, symbolId, side, amount: String(body.amount ?? body.quantity ?? ""), hour: Number(body.hour ?? 0) });
    } else if (action === "cancel-twap" || action === "cancel-dca") {
      signType = action === "cancel-dca" ? "cancelDcaOrder" : "cancelTwapOrder";
      params = cancelTwapParams(accountId, symbolId, String(body.orderId ?? ""));
    } else if (market === "spot") {
      return NextResponse.json({ error: "Use the spot order review for this action." }, { status: 400 });
    } else if (action === "cancel") {
      signType = "cancelOrder";
      params = perpsCancelParams(accountId, symbolId, String(body.orderId ?? ""));
    } else if (action === "replace") {
      signType = "replaceOrder";
      params = perpsReplaceParams({ accountId, symbolId, clOrdID: `r${nonce}`.slice(0, 36), origOrderId: String(body.orderId ?? ""), price: body.price ? String(body.price) : undefined, quantity: body.quantity ? String(body.quantity) : undefined });
    } else if (action === "modify") {
      signType = "modifyOrder";
      params = perpsModifyStopParams({ accountId, symbolId, orderId: String(body.orderId ?? ""), stopPrice: body.stopPrice ? String(body.stopPrice) : undefined, quantity: body.quantity ? String(body.quantity) : undefined });
    } else if (action === "stop") {
      const order = reduceOnlyStop({ clOrdID: id, side, stopPrice: String(body.stopPrice ?? ""), stopKind: body.stopKind === "take-profit" ? "take-profit" : "stop-loss", quantity: body.quantity ? String(body.quantity) : undefined });
      params = perpsNewOrderParams({ accountId, symbolId, orders: [order], builder: optionalPerpsBuilder(body.includeBuilder === true) });
    } else if (action === "bracket") {
      const orders = bracketOrders({ entryId: id, side, type, price: body.price ? String(body.price) : undefined, quantity: String(body.quantity ?? ""), takeProfit: body.takeProfit ? String(body.takeProfit) : undefined, stopLoss: body.stopLoss ? String(body.stopLoss) : undefined });
      params = perpsNewOrderParams({ accountId, symbolId, orders, builder: optionalPerpsBuilder(body.includeBuilder === true) });
    } else {
      const order = normalPerpsOrder({ clOrdID: id, side, type, price: body.price ? String(body.price) : undefined, quantity: String(body.quantity ?? "") });
      params = perpsNewOrderParams({ accountId, symbolId, orders: [order], builder: optionalPerpsBuilder(body.includeBuilder === true) });
    }
    const payloadHash = hashAction(signType, params);
    const typedData = market === "perps"
      ? futuresTypedData(network, payloadHash, BigInt(nonce))
      : buildSpotExchangeTypedData({ network, payloadHash, nonce: BigInt(nonce) });
    return NextResponse.json({
      prepared: { network, market, signType, params, payloadHash, nonce, typedData },
      submission: cfg.executionEnabled ? "enabled" : "disabled",
      chainId: 286623,
      note: "Review this payload, then sign. A later change of account, network, or terms requires a new review.",
    });
  } catch (e) {
    const { body: b, status } = jsonPublicError("prepare-perps", e);
    return NextResponse.json(b, { status });
  }
}
