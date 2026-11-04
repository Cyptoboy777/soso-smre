import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { prepareBuilderApproval } from "@/lib/sodex-wallet-trade";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-approve-prep:${ip}`,
    30,
    60 * 60_000,
    "Rate limit: builder approval prepare",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  if (!cfg.builderId) {
    return NextResponse.json(
      { error: "SODEX_BUILDER_ID is not set on this deploy" },
      { status: 400 },
    );
  }

  const body = (await req.json()) as {
    userAddress?: string;
    accountId?: number;
    network?: SodexNetworkLabel;
    maxFeeRate?: number;
  };

  const userAddress = (body.userAddress ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(userAddress)) {
    return NextResponse.json({ error: "Valid userAddress required" }, { status: 400 });
  }
  const accountId = Number(body.accountId);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Valid accountId required" }, { status: 400 });
  }

  const network = body.network === "mainnet" ? "mainnet" : body.network === "testnet" ? "testnet" : cfg.network;
  if (network === "mainnet" && !cfg.mainnetTradingEnabled) {
    return NextResponse.json(
      { error: "Mainnet blocked: SODEX_MAINNET_TRADING kill switch is off" },
      { status: 403 },
    );
  }

  try {
    const prepared = prepareBuilderApproval({
      userAddress,
      accountId,
      network,
      maxFeeRate: body.maxFeeRate,
    });
    return NextResponse.json({
      prepared,
      disclosure: {
        builderId: prepared.builderId,
        maxFeeRate: prepared.maxFeeRate,
        maxFeeLabel: prepared.maxFeeLabel,
        note: "You are approving a maximum builder fee for FlowSentinel's Builder ID. You can clear it later with maxFeeRate 0. Signing uses your master wallet only — FlowSentinel never receives your private key.",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
