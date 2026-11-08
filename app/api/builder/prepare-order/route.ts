import { NextResponse } from "next/server";
import { getBuilderConfig, spotApiBase, buildSpotExchangeTypedData, builderParamsFromConfig, withBatchBuilder, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { prepareUserSpotOrder, resolveSymbolIdOnNetwork, buildSpotBatchParams, hashExchangePayload } from "@/lib/sodex-wallet-trade";
import { gridCrosses } from "@/lib/grid-plan";
import { isAllowedTradeSymbol } from "@/lib/trade-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { jsonPublicError, logServerError } from "@/lib/public-errors";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";
import { claimPreparedNonce } from "@/lib/nonce-policy";
import { quoteIsStale } from "@/lib/cost-lens";
import { readSpotOrders, restingFrom } from "@/lib/sodex-account-read";
import { selfTradeCheck } from "@/lib/self-trade";
import { checkOrderFilters, multiplyDecimal, parseSymbolFilters } from "@/lib/decimal-rule";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-order-prep:${ip}`,
    40,
    60 * 60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  let body: {
    userAddress?: string;
    accountId?: number;
    network?: SodexNetworkLabel;
    symbol?: string;
    side?: "buy" | "sell";
    type?: "limit" | "market";
    quantity?: string | number;
    price?: string | number;
    confirmed?: boolean;
    dryRun?: boolean;
    includeBuilder?: boolean;
    requireFreshQuote?: boolean;
    quoteFetchedAt?: string;
    nonce?: string;
    grid?: Array<{ side?: "buy" | "sell"; price?: string; quantity?: string }>;
  };
  try {
    const _p = await readJsonBodyLimited(req);
    if (!_p.ok) {
      return NextResponse.json({ error: _p.error }, { status: 413 });
    }
    body = _p.value as typeof body;
  } catch (e) {
    const { body: b, status } = jsonPublicError("prepare-order", e);
    return NextResponse.json(b, { status });
  }

  const dryRun = Boolean(body.dryRun);
  if (!body.confirmed && !dryRun) {
    return NextResponse.json(
      { error: "Please confirm the details before continuing." },
      { status: 400 },
    );
  }

  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json(
      { error: "Connect a valid wallet to continue." },
      { status: 400 },
    );
  }
  const accountId = Number(body.accountId);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    return NextResponse.json(
      { error: "Your trading account is not ready yet." },
      { status: 400 },
    );
  }

  const symbol = String(body.symbol ?? "").trim();
  if (!isAllowedTradeSymbol(symbol)) {
    return NextResponse.json(
      { error: "That market is not available here." },
      { status: 400 },
    );
  }

  const side = body.side === "sell" ? "sell" : "buy";
  const type = body.type === "market" ? "market" : "limit";
  const quantity = String(body.quantity ?? "").trim();
  const price = body.price != null ? String(body.price).trim() : undefined;
  const qtyNum = Number(quantity);
  const priceNum = price != null ? Number(price) : 0;
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
    return NextResponse.json({ error: "Enter a valid size." }, { status: 400 });
  }
  const notional =
    type === "limit"
      ? qtyNum * priceNum
      : side === "buy"
        ? qtyNum
        : 0;
  if (type === "limit" && (!Number.isFinite(priceNum) || priceNum <= 0)) {
    return NextResponse.json({ error: "Enter a valid limit price." }, { status: 400 });
  }
  if ((type === "limit" || (type === "market" && side === "buy")) && notional > cfg.maxNotionalUsdc + 1e-9) {
    return NextResponse.json({ error: "Order size exceeds the app limit." }, { status: 400 });
  }
  if (body.requireFreshQuote && quoteIsStale(body.quoteFetchedAt)) {
    return NextResponse.json(
      { error: "The quote expired. Refresh the book and review the order again." },
      { status: 409 },
    );
  }
  if (!body.nonce || !/^[0-9]+$/.test(body.nonce)) {
    return NextResponse.json(
      { error: "Reserve a signing nonce in this browser before preparing the order." },
      { status: 400 },
    );
  }

  const network: SodexNetworkLabel =
    body.network === "mainnet"
      ? "mainnet"
      : body.network === "testnet"
        ? "testnet"
        : cfg.network;

  try {
    if (network === "mainnet" && !cfg.mainnetTradingEnabled && !dryRun) {
      logServerError(
        "prepare-order",
        "mainnet live prepare refused (trading not enabled)",
      );
      return NextResponse.json(
        {
          error:
            "Live trading is not available right now. You can keep practicing on the practice network.",
        },
        { status: 403 },
      );
    }

    const symbolId = await resolveSymbolIdOnNetwork(network, symbol);
    if (symbolId == null) {
      return NextResponse.json(
        { error: "That market is not available right now." },
        { status: 400 },
      );
    }

    const filters = await readSymbolFilters(network, symbol);
    const notionalText =
      type === "limit" && price
        ? multiplyDecimal(price, quantity)
        : type === "market" && side === "buy"
          ? quantity
          : null;
    const filterCheck = checkOrderFilters({
      price: type === "limit" ? price : undefined,
      quantity: type === "market" && side === "buy" ? undefined : quantity,
      notional: notionalText ?? undefined,
      filters: filters.filters,
      filtersKnown: filters.known,
    });
    if (!filterCheck.ok) {
      return NextResponse.json(
        { error: filterCheck.issues[0]?.message ?? "That order does not match the market rules." },
        { status: 400 },
      );
    }

    const open = await readSpotOrders(network, userAddress, accountId);
    const cross = selfTradeCheck({
      side,
      type,
      price: type === "limit" ? priceNum : null,
      resting: open.available ? restingFrom(open.open) : [],
      bookKnown: open.available,
    });
    if (cross.state === "blocked") {
      return NextResponse.json({ error: cross.detail }, { status: 409 });
    }

    const claimed = claimPreparedNonce({
      network,
      signingAddress: userAddress,
      nonce: String(body.nonce),
    });
    if (!claimed.ok) {
      return NextResponse.json({ error: claimed.error }, { status: 409 });
    }

    if (Array.isArray(body.grid) && body.grid.length > 0) {
      if (body.grid.length > 6) {
        return NextResponse.json({ error: "This review allows at most six orders." }, { status: 400 });
      }
      const lines = body.grid.map((line) => ({
        side: line.side === "sell" ? ("sell" as const) : ("buy" as const),
        price: String(line.price ?? "").trim(),
        quantity: String(line.quantity ?? "").trim(),
      }));
      if (lines.some((line) => !/^\d+(\.\d+)?$/.test(line.price) || !/^\d+(\.\d+)?$/.test(line.quantity))) {
        return NextResponse.json({ error: "Each grid order needs a price and a size." }, { status: 400 });
      }
      if (gridCrosses(lines)) {
        return NextResponse.json(
          { error: "These orders cross each other. Widen the prices before signing." },
          { status: 409 },
        );
      }
      const builder = body.includeBuilder ? builderParamsFromConfig(cfg) : null;
      const orders = lines.map((line, index) => {
        const batch = buildSpotBatchParams({
          accountId,
          symbolId,
          clOrdID: `g${body.nonce}-${index}`.slice(0, 36),
          side: line.side,
          type: "limit",
          price: line.price,
          quantity: line.quantity,
          builder: null,
        });
        return (batch.orders as unknown[])[0];
      });
      const params = withBatchBuilder({ accountID: accountId, orders }, builder);
      const nonce = BigInt(String(body.nonce));
      const payloadHash = hashExchangePayload("batchNewOrder", params);
      return NextResponse.json({
        prepared: {
          network,
          signType: "batchNewOrder",
          params,
          payloadHash,
          nonce: nonce.toString(),
          typedData: buildSpotExchangeTypedData({ network, payloadHash, nonce }),
          feeDisclosure: {
            feeLabel: builder ? `Includes a ${cfg.appFeePercent} app fee` : "No app fee on this order",
            spotBuyNote: cfg.feeDisclosure.spotBuyExempt,
          },
          confirmSummary: {
            symbol,
            side: "batch",
            type: "limit",
            quantity: String(lines.length),
            price: lines.map((line) => `${line.side} ${line.quantity} @ ${line.price}`).join("; "),
            maxNotionalUsdc: cfg.maxNotionalUsdc,
            mode: network === "mainnet" && cfg.mainnetTradingEnabled ? "live" : "practice",
          },
        },
        practiceOnly: !(network === "mainnet" && cfg.mainnetTradingEnabled),
        note: "Review every grid order. One signature sends the whole list. Nothing keeps quoting after that.",
      });
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
      confirmed: Boolean(body.confirmed) || dryRun,
      dryRun: dryRun || (network === "mainnet" && !cfg.mainnetTradingEnabled),
      signingAddress: userAddress,
      includeBuilder: Boolean(body.includeBuilder),
      nonce: body.nonce,
    });

    // Strip internal fields from client payload
    const {
      endpoint: _endpoint,
      dryRun: isDry,
      realFundsWarning,
      feeEngineNotes,
      feeDisclosure,
      confirmSummary,
      ...signable
    } = prepared;
    void _endpoint;

    return NextResponse.json({
      prepared: {
        ...signable,
        feeDisclosure: {
          feeLabel: feeDisclosure.feeLabel,
          spotBuyNote: feeDisclosure.spotBuyNote,
        },
        confirmSummary: {
          symbol: confirmSummary.symbol,
          side: confirmSummary.side,
          type: confirmSummary.type,
          quantity: confirmSummary.quantity,
          price: confirmSummary.price,
          maxNotionalUsdc: confirmSummary.maxNotionalUsdc,
          mode: network === "mainnet" && cfg.mainnetTradingEnabled ? "live" : "practice",
        },
        feeNotes: feeEngineNotes,
        realFundsWarning:
          network === "mainnet" && cfg.mainnetTradingEnabled
            ? realFundsWarning
            : null,
        selfTrade: cross.state,
        filtersKnown: filters.known,
      },
      userAddress,
      mustConfirmAgain: true,
      practiceOnly: isDry || !(network === "mainnet" && cfg.mainnetTradingEnabled),
      note: "Review the fee, then sign in your wallet. FlowSentinel never holds your keys.",
    });
  } catch (e) {
    const { body: b, status } = jsonPublicError("prepare-order", e);
    return NextResponse.json(b, { status });
  }
}

async function readSymbolFilters(network: SodexNetworkLabel, symbol: string) {
  try {
    const res = await fetch(`${spotApiBase(network)}/markets/symbols`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return { filters: {}, known: false };
    const body = (await res.json()) as {
      code?: number;
      data?: Array<Record<string, unknown>> | { list?: Array<Record<string, unknown>> };
    };
    if (typeof body.code === "number" && body.code !== 0) return { filters: {}, known: false };
    const rows = Array.isArray(body.data)
      ? body.data
      : body.data && Array.isArray(body.data.list)
        ? body.data.list
        : [];
    const want = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const hit = rows.find((row) => {
      const name = String(row.name ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      return name.includes(want) || want.includes(name);
    });
    return parseSymbolFilters(hit);
  } catch {
    return { filters: {}, known: false };
  }
}
