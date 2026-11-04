import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { relayUserSpotOrder } from "@/lib/sodex-wallet-trade";
import { recordRoutedOrder } from "@/lib/builder-metrics";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-order-relay:${ip}`,
    12,
    60 * 60_000,
    "Rate limit: order relay",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  const body = (await req.json()) as {
    userAddress?: string;
    network?: SodexNetworkLabel;
    params?: Record<string, unknown>;
    nonce?: string;
    signature?: string;
    apiKeyName?: string;
    confirmed?: boolean;
  };

  if (!body.confirmed) {
    return NextResponse.json({ error: "Explicit confirmation required" }, { status: 400 });
  }

  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Valid userAddress required" }, { status: 400 });
  }
  if (!body.params || !body.nonce || !body.signature) {
    return NextResponse.json(
      { error: "params, nonce, signature required" },
      { status: 400 },
    );
  }

  const network = body.network === "mainnet" ? "mainnet" : "testnet";
  if (network === "mainnet") {
    if (!cfg.builderId || !cfg.mainnetTradingEnabled) {
      return NextResponse.json(
        { error: "Mainnet trading blocked by kill switch / missing Builder ID" },
        { status: 403 },
      );
    }
  }

  // Ensure builder tag matches server config when present
  const b = body.params.builder as { id?: number; fee?: number } | undefined;
  if (cfg.builderId != null) {
    if (!b || b.id !== cfg.builderId) {
      return NextResponse.json(
        { error: "Order builder.id must match SODEX_BUILDER_ID" },
        { status: 400 },
      );
    }
  } else if (b) {
    return NextResponse.json(
      { error: "Unexpected builder on order while SODEX_BUILDER_ID unset" },
      { status: 400 },
    );
  }

  const result = await relayUserSpotOrder({
    network,
    params: body.params,
    nonce: String(body.nonce),
    signature: body.signature,
    apiKeyName: body.apiKeyName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  recordRoutedOrder(userAddress);
  return NextResponse.json({
    ok: true,
    raw: result.raw,
    network,
    builderId: cfg.builderId,
  });
}
