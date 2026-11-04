import { NextResponse } from "next/server";
import { getBuilderConfig } from "@/lib/sodex-builder";
import { readBuilderMetrics } from "@/lib/builder-metrics";

export const dynamic = "force-dynamic";

/** Public builder race config — never returns private keys. */
export async function GET() {
  const cfg = getBuilderConfig();
  return NextResponse.json({
    builderId: cfg.builderId,
    builderFee: cfg.builderFee,
    feeLabel: cfg.feeLabel,
    maxApproval: cfg.maxApproval,
    maxApprovalLabel: cfg.maxApprovalLabel,
    mainnetTradingEnabled: cfg.mainnetTradingEnabled,
    network: cfg.network,
    maxNotionalUsdc: cfg.maxNotionalUsdc,
    builderReady: cfg.builderReady,
    notes: cfg.notes,
    metrics: readBuilderMetrics(),
  });
}
