import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { relayUserSpotOrder } from "@/lib/sodex-wallet-trade";
import { recordRoutedOrder } from "@/lib/builder-metrics";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { logServerError, publicErrorMessage } from "@/lib/public-errors";
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

  const network = body.network === "mainnet" ? "mainnet" : "testnet";
  if (network === "mainnet") {
    if (!cfg.builderId || !cfg.mainnetTradingEnabled) {
      logServerError("relay-order", "mainnet relay refused");
      return NextResponse.json(
        {
          error:
            "Live trading is not available right now. You can keep practicing on the practice network.",
        },
        { status: 403 },
      );
    }
  }

  // Ensure builder tag matches server config when present
  const b = body.params.builder as { id?: number; fee?: number } | undefined;
  if (cfg.builderId != null) {
    if (!b || b.id !== cfg.builderId) {
      logServerError("relay-order", "builder id mismatch on order");
      return NextResponse.json(
        { error: "This order could not be verified. Please try again." },
        { status: 400 },
      );
    }
  } else if (b) {
    logServerError("relay-order", "unexpected builder tag");
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

  if (!result.ok) {
    logServerError("relay-order", result.error);
    return NextResponse.json(
      { error: publicErrorMessage(result.error) },
      { status: 502 },
    );
  }

  recordRoutedOrder(userAddress);
  return NextResponse.json({
    ok: true,
    mode: network === "mainnet" && cfg.mainnetTradingEnabled ? "live" : "practice",
  });
}
