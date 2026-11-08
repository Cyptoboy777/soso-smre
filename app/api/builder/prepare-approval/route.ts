import { NextResponse } from "next/server";
import { getBuilderConfig, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { prepareBuilderApproval } from "@/lib/sodex-wallet-trade";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { jsonPublicError, logServerError } from "@/lib/public-errors";
import { readJsonBodyLimited } from "@/lib/builder-order-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-approve-prep:${ip}`,
    30,
    60 * 60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  if (!cfg.builderId) {
    logServerError("prepare-approval", "builder id missing");
    return NextResponse.json(
      { error: "App fee approval is not available right now." },
      { status: 400 },
    );
  }

  let body: {
    userAddress?: string;
    accountId?: number;
    network?: SodexNetworkLabel;
    maxFeeRate?: number;
    dryRun?: boolean;
  };
  try {
    const _p = await readJsonBodyLimited(req);
    if (!_p.ok) {
      return NextResponse.json({ error: _p.error }, { status: 413 });
    }
    body = _p.value as typeof body;
  } catch (e) {
    const { body: b, status } = jsonPublicError("prepare-approval", e);
    return NextResponse.json(b, { status });
  }

  const dryRun = Boolean(body.dryRun);
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

  const network =
    body.network === "mainnet"
      ? "mainnet"
      : body.network === "testnet"
        ? "testnet"
        : cfg.network;

  try {
    const prepared = prepareBuilderApproval({
      userAddress,
      accountId,
      network,
      maxFeeRate: body.maxFeeRate,
    });
    const { endpoint: _e, ...safePrepared } = prepared;
    void _e;
    return NextResponse.json({
      prepared: safePrepared,
      submission: cfg.executionEnabled ? "enabled" : "disabled",
      chainId: 286623,
      disclosure: {
        maxFeeLabel: `up to ${cfg.maxApprovalPercent}`,
        feeLine: `Includes a ${cfg.appFeePercent} app fee`,
        notes: [
          cfg.feeDisclosure.caps,
          cfg.feeDisclosure.perpsBothSides,
          cfg.feeDisclosure.spotBuyExempt,
        ],
        note: "You are approving a maximum app fee. You can revoke this later from your SoDEX account. FlowSentinel never receives your private key.",
      },
      realFundsWarning:
        network === "mainnet" && cfg.mainnetTradingEnabled
          ? cfg.realFundsWarning
          : null,
    });
  } catch (e) {
    const { body: b, status } = jsonPublicError("prepare-approval", e);
    return NextResponse.json(b, { status });
  }
}
