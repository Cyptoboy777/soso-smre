import { NextResponse } from "next/server";
import { readBuilderMetrics } from "@/lib/builder-metrics";
import { getBuilderConfig } from "@/lib/sodex-builder";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-metrics:${ip}`,
    40,
    60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const cfg = getBuilderConfig();
  const metrics = readBuilderMetrics();
  return NextResponse.json({
    builderReady: cfg.builderReady,
    mode: cfg.network === "mainnet" && cfg.mainnetTradingEnabled ? "live" : "practice",
    metrics: {
      ordersRouted: metrics.ordersRouted,
      uniqueWallets: metrics.uniqueWallets,
      lastOrderAt: metrics.lastOrderAt,
    },
  });
}
