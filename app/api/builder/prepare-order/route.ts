import { NextResponse } from "next/server";
import { getBuilderConfig, clampNotional, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { prepareUserSpotOrder } from "@/lib/sodex-wallet-trade";
import { resolveSymbolIdOnNetwork } from "@/lib/sodex-wallet-trade";
import { isAllowedTradeSymbol } from "@/lib/trade-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-order-prep:${ip}`,
    40,
    60 * 60_000,
    "Rate limit: order prepare",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  const body = (await req.json()) as {
    userAddress?: string;
    accountId?: number;
    network?: SodexNetworkLabel;
    symbol?: string;
    side?: "buy" | "sell";
    type?: "limit" | "market";
    quantity?: string | number;
    price?: string | number;
    confirmed?: boolean;
  };

  if (!body.confirmed) {
    return NextResponse.json(
      { error: "Explicit confirmation required to prepare a live ticket" },
      { status: 400 },
    );
  }

  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Valid userAddress required" }, { status: 400 });
  }
  const accountId = Number(body.accountId);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Valid accountId required" }, { status: 400 });
  }

  const symbol = String(body.symbol ?? "").trim();
  if (!isAllowedTradeSymbol(symbol)) {
    return NextResponse.json({ error: "Symbol not allowlisted" }, { status: 400 });
  }

  const side = body.side === "sell" ? "sell" : "buy";
  const type = body.type === "market" ? "market" : "limit";
  let quantity = String(body.quantity ?? "");
  const price = body.price != null ? String(body.price) : undefined;
  const qtyNum = Number(quantity);
  const priceNum = price != null ? Number(price) : 0;
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }
  if (type === "limit") {
    const notional = qtyNum * priceNum;
    const capped = clampNotional(notional);
    if (priceNum > 0 && notional > capped) {
      quantity = String(capped / priceNum);
    }
  } else if (side === "buy") {
    // market buy: quantity is quote funds
    quantity = String(clampNotional(qtyNum));
  }

  const network: SodexNetworkLabel =
    body.network === "mainnet"
      ? "mainnet"
      : body.network === "testnet"
        ? "testnet"
        : cfg.network;

  try {
    const symbolId = await resolveSymbolIdOnNetwork(network, symbol);
    if (symbolId == null) {
      return NextResponse.json(
        { error: `Unknown symbol on ${network}: ${symbol}` },
        { status: 400 },
      );
    }
    const prepared = prepareUserSpotOrder({
      network,
      accountId,
      symbol,
      symbolId,
      side,
      type,
      quantity,
      price: type === "limit" ? price : undefined,
      confirmed: true,
    });
    return NextResponse.json({
      prepared,
      userAddress,
      mustConfirmAgain: true,
      note: "Review fee disclosure, then sign ExchangeAction in your wallet. FlowSentinel relays only — it never submits without your signature.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
