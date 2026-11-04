import { NextResponse } from "next/server";
import { getBuilderConfig, clampNotional, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { prepareUserSpotOrder, resolveSymbolIdOnNetwork } from "@/lib/sodex-wallet-trade";
import { isAllowedTradeSymbol } from "@/lib/trade-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { jsonPublicError, logServerError } from "@/lib/public-errors";

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
  };
  try {
    body = (await req.json()) as typeof body;
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
  let quantity = String(body.quantity ?? "");
  const price = body.price != null ? String(body.price) : undefined;
  const qtyNum = Number(quantity);
  const priceNum = price != null ? Number(price) : 0;
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
    return NextResponse.json({ error: "Enter a valid size." }, { status: 400 });
  }
  if (type === "limit") {
    const notional = qtyNum * priceNum;
    const capped = clampNotional(notional);
    if (priceNum > 0 && notional > capped) {
      quantity = String(capped / priceNum);
    }
  } else if (side === "buy") {
    quantity = String(clampNotional(qtyNum));
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
          feeLabel: `Includes a ${cfg.appFeePercent} app fee`,
          spotBuyNote: cfg.feeDisclosure.spotBuyExempt,
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
