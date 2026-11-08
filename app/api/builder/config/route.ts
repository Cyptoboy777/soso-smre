import { NextResponse } from "next/server";
import { getBuilderConfig } from "@/lib/sodex-builder";
import { getBuilderOwnerAddress } from "@/lib/sodex-builder-fee-stats";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

/** Public client config only. No env names, notes, gateways, or metrics dumps. */
export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-config:${ip}`,
    120,
    60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  const live = cfg.network === "mainnet" && cfg.mainnetTradingEnabled;
  return NextResponse.json({
    builderId: cfg.builderId,
    appFeePercent: cfg.appFeePercent,
    maxApprovalPercent: cfg.maxApprovalPercent,
    builderFee: cfg.builderFee,
    maxApproval: cfg.maxApproval,
    maxNotionalUsdc: cfg.maxNotionalUsdc,
    targetNetwork: "mainnet",
    chainId: 286623,
    executionEnabled: cfg.executionEnabled,
    reads: "mainnet",
    submission: cfg.executionEnabled ? "enabled" : "disabled",
    mode: cfg.executionEnabled ? "live" : "review",
    tradingLive: cfg.executionEnabled,
    builderReady: cfg.builderReady,
    feeLine: `Includes a ${cfg.appFeePercent} app fee`,
    feeDisclosure: cfg.feeDisclosure,
    realFundsWarning: live ? cfg.realFundsWarning : null,
    statsAvailable: getBuilderOwnerAddress() != null && cfg.builderId != null,
  });
}
