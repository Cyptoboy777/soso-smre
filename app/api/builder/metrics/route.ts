import { NextResponse } from "next/server";
import { readBuilderMetrics } from "@/lib/builder-metrics";
import { getBuilderConfig } from "@/lib/sodex-builder";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getBuilderConfig();
  return NextResponse.json({
    builderIdSet: cfg.builderId != null,
    network: cfg.network,
    metrics: readBuilderMetrics(),
  });
}
