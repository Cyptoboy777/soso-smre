import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { prepareUserSpotCancel, resolveSymbolIdOnNetwork } from "@/lib/sodex-wallet-trade";
import { isAllowedTradeSymbol } from "@/lib/trade-guard";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { jsonPublicError, logServerError } from "@/lib/public-errors";
import { claimPreparedNonce } from "@/lib/nonce-policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rejectIfRateLimited(
    `builder-cancel-prep:${clientIp(req)}`,
    20,
    60 * 60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const parsed = await readJsonBodyLimited(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 413 });
  const body = parsed.value as {
    userAddress?: string;
    accountId?: number;
    network?: SodexNetworkLabel;
    symbol?: string;
    orderId?: string;
    origClOrdID?: string;
    nonce?: string;
    confirmed?: boolean;
  };
  if (!body.confirmed) {
    return NextResponse.json({ error: "Please confirm the cancel before continuing." }, { status: 400 });
  }
  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Connect a valid wallet to continue." }, { status: 400 });
  }
  const accountId = Number(body.accountId);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Your trading account is not ready yet." }, { status: 400 });
  }
  const symbol = String(body.symbol ?? "").trim();
  if (!isAllowedTradeSymbol(symbol)) {
    return NextResponse.json({ error: "That market is not available here." }, { status: 400 });
  }
  const cfg = getBuilderConfig();
  const network: SodexNetworkLabel = body.network === "mainnet" ? "mainnet" : "testnet";
  if (network === "mainnet" && !cfg.mainnetTradingEnabled) {
    logServerError("prepare-cancel", "mainnet cancel refused");
    return NextResponse.json(
      { error: "Live trading is not available right now. You can keep using the practice network." },
      { status: 403 },
    );
  }
  try {
    const symbolId = await resolveSymbolIdOnNetwork(network, symbol);
    if (symbolId == null) {
      return NextResponse.json({ error: "That market is not available right now." }, { status: 400 });
    }
    if (!body.nonce || !/^[0-9]+$/.test(body.nonce)) {
      return NextResponse.json(
        { error: "Reserve a signing nonce in this browser before preparing the cancel." },
        { status: 400 },
      );
    }
    const claimed = claimPreparedNonce({ network, signingAddress: userAddress, nonce: body.nonce });
    if (!claimed.ok) return NextResponse.json({ error: claimed.error }, { status: 409 });
    const prepared = prepareUserSpotCancel({
      network,
      accountId,
      symbolId,
      orderId: String(body.orderId ?? ""),
      origClOrdID: body.origClOrdID,
      signingAddress: userAddress,
      nonce: body.nonce,
      confirmed: true,
    });
    return NextResponse.json({
      stage: "prepared",
      prepared: {
        network: prepared.network,
        signType: prepared.signType,
        params: prepared.params,
        payloadHash: prepared.payloadHash,
        nonce: prepared.nonce,
        typedData: prepared.typedData,
      },
      note: "Cancelling needs its own signature. A resting size can remain until the exchange confirms the cancel.",
    });
  } catch (e) {
    const { body: b, status } = jsonPublicError("prepare-cancel", e);
    return NextResponse.json(b, { status });
  }
}
