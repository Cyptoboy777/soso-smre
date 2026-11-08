import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { relayUserSpotCancel } from "@/lib/sodex-wallet-trade";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { logServerError, publicErrorMessage } from "@/lib/public-errors";
import { parseBatchReceipt } from "@/lib/order-receipt";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rejectIfRateLimited(
    `builder-cancel-relay:${clientIp(req)}`,
    12,
    60 * 60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const parsed = await readJsonBodyLimited(req);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 413 });
  const body = parsed.value as {
    userAddress?: string;
    network?: SodexNetworkLabel;
    params?: Record<string, unknown>;
    nonce?: string;
    signature?: string;
    confirmed?: boolean;
  };
  if (!body.confirmed) {
    return NextResponse.json({ error: "Please confirm the cancel before continuing." }, { status: 400 });
  }
  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Connect a valid wallet to continue." }, { status: 400 });
  }
  if (!body.params || !body.nonce || !body.signature) {
    return NextResponse.json({ error: "Something is missing from the cancel request." }, { status: 400 });
  }
  const cfg = getBuilderConfig();
  if (!cfg.executionEnabled) {
    logServerError("relay-cancel", "submission refused");
    return NextResponse.json({ error: "Order submission is not enabled." }, { status: 403 });
  }
  const network: SodexNetworkLabel = "mainnet";
  const result = await relayUserSpotCancel({
    network,
    params: body.params,
    nonce: String(body.nonce),
    signature: body.signature,
  });
  if (!result.ok && !result.venueRejected) {
    logServerError("relay-cancel", result.error);
    return NextResponse.json({ error: publicErrorMessage(result.error) }, { status: 502 });
  }
  const receipt = parseBatchReceipt(result.raw);
  return NextResponse.json({
    ok: receipt.stage === "accepted",
    receipt: {
      ...receipt,
      message:
        receipt.stage === "accepted"
          ? "Cancel accepted. Check the order again before assuming the size is gone."
          : receipt.message,
    },
    retryAllowed: false,
  });
}
