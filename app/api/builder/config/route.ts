import { NextResponse } from "next/server";
import { getBuilderConfig } from "@/lib/sodex-builder";
import { getBuilderOwnerAddress } from "@/lib/sodex-builder-fee-stats";

export const dynamic = "force-dynamic";

/**
 * Public client config only. No env names, notes, gateways, or metrics dumps.
 */
export async function GET() {
  const cfg = getBuilderConfig();
  const live = cfg.network === "mainnet" && cfg.mainnetTradingEnabled;
  return NextResponse.json({
    builderId: cfg.builderId,
    appFeePercent: cfg.appFeePercent,
    maxApprovalPercent: cfg.maxApprovalPercent,
    /** Requested fee in tenths-of-bp for signing payloads only. */
    builderFee: cfg.builderFee,
    maxApproval: cfg.maxApproval,
    maxNotionalUsdc: cfg.maxNotionalUsdc,
    /** practice = testnet / non-live; live = real funds path enabled */
    mode: live ? "live" : "practice",
    tradingLive: live,
    builderReady: cfg.builderReady,
    feeLine: `Includes a ${cfg.appFeePercent} app fee`,
    feeDisclosure: cfg.feeDisclosure,
    realFundsWarning: live ? cfg.realFundsWarning : null,
    statsAvailable: getBuilderOwnerAddress() != null && cfg.builderId != null,
  });
}
