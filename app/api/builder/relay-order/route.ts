import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { relayUserSpotOrder } from "@/lib/sodex-wallet-trade";
import { recordRoutedOrder } from "@/lib/builder-metrics";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { logServerError, publicErrorMessage } from "@/lib/public-errors";
import { parseBatchReceipt } from "@/lib/order-receipt";
import {
  assertRelayOrderParams,
  readJsonBodyLimited,
} from "@/lib/builder-order-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-order-relay:${ip}`,
    12,
    60 * 60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  const parsed = await readJsonBodyLimited(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 413 });
  }
  const body = parsed.value as {
    userAddress?: string;
    network?: SodexNetworkLabel;
    params?: Record<string, unknown>;
    nonce?: string;
    signature?: string;
    apiKeyName?: string;
    confirmed?: boolean;
  };

  if (!body.confirmed) {
    return NextResponse.json({ error: "Please confirm the details before continuing." }, { status: 400 });
  }

  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Connect a valid wallet to continue." }, { status: 400 });
  }
  if (!body.params || !body.nonce || !body.signature) {
    return NextResponse.json(
      { error: "Something is missing from the order request. Please try again." },
      { status: 400 },
    );
  }

  if (!cfg.executionEnabled) {
    logServerError("relay-order", "submission refused");
    return NextResponse.json({ error: "Order submission is not enabled." }, { status: 403 });
  }
  const network = "mainnet" as const;

  // Ensure builder tag matches server config when present
  const b = body.params.builder as { id?: number; fee?: number } | undefined;
  if (b && (cfg.builderId == null || b.id !== cfg.builderId)) {
    logServerError("relay-order", "builder id mismatch on order");
    return NextResponse.json(
      { error: "This order could not be verified. Please try again." },
      { status: 400 },
    );
  }

  const paramsCheck = assertRelayOrderParams(body.params);
  if (!paramsCheck.ok) {
    logServerError("relay-order", paramsCheck.error);
    return NextResponse.json({ error: paramsCheck.error }, { status: 400 });
  }

  const result = await relayUserSpotOrder({
    network,
    params: body.params,
    nonce: String(body.nonce),
    signature: body.signature,
    apiKeyName: body.apiKeyName,
  });

  if (!result.ok && !result.venueRejected) {
    logServerError("relay-order", result.error);
    return NextResponse.json(
      { error: publicErrorMessage(result.error) },
      { status: 502 },
    );
  }

  const receipt = parseBatchReceipt(result.ok || result.venueRejected ? result.raw : undefined);
  if (receipt.stage === "accepted") recordRoutedOrder(userAddress);
  return NextResponse.json({
    ok: receipt.stage === "accepted",
    mode: cfg.executionEnabled ? "live" : "review",
    receipt,
    retryAllowed: false,
  });
}
