import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { relayBuilderApproval } from "@/lib/sodex-wallet-trade";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-approve-relay:${ip}`,
    20,
    60 * 60_000,
    "Rate limit: builder approval relay",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  if (!cfg.builderId) {
    return NextResponse.json(
      { error: "SODEX_BUILDER_ID is not set" },
      { status: 400 },
    );
  }

  const body = (await req.json()) as {
    userAddress?: string;
    network?: SodexNetworkLabel;
    apiChain?: number;
    nonce?: string;
    signature?: string;
    accountID?: number;
    builderID?: number;
    maxFeeRate?: number;
  };

  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Valid userAddress required" }, { status: 400 });
  }
  if (!body.signature || !body.nonce || body.apiChain == null) {
    return NextResponse.json(
      { error: "signature, nonce, apiChain required" },
      { status: 400 },
    );
  }
  if (body.builderID !== cfg.builderId) {
    return NextResponse.json(
      { error: "builderID must match server SODEX_BUILDER_ID" },
      { status: 400 },
    );
  }

  const network = body.network === "mainnet" ? "mainnet" : "testnet";
  if (network === "mainnet" && !cfg.mainnetTradingEnabled) {
    return NextResponse.json(
      { error: "Mainnet blocked: kill switch off" },
      { status: 403 },
    );
  }

  const result = await relayBuilderApproval({
    userAddress,
    network,
    apiChain: Number(body.apiChain),
    nonce: String(body.nonce),
    signature: body.signature,
    body: {
      accountID: Number(body.accountID),
      builderID: Number(body.builderID),
      maxFeeRate: Number(body.maxFeeRate),
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, raw: result.raw });
}
