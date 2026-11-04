import { NextResponse } from "next/server";
import { fetchBuilderFeeStatsBundle } from "@/lib/sodex-builder-fee-stats";
import { readBuilderMetrics } from "@/lib/builder-metrics";
import type { SodexNetworkLabel } from "@/lib/sodex-builder";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `builder-fee-stats:${ip}`,
    40,
    60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const url = new URL(req.url);
  const netRaw = url.searchParams.get("network");
  const network: SodexNetworkLabel =
    netRaw === "testnet" ? "testnet" : "mainnet";
  const limitRaw = Number(url.searchParams.get("limit") || "90");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 90;

  const local = readBuilderMetrics();
  const bundle = await fetchBuilderFeeStatsBundle({
    network,
    limit,
    localRelay: {
      ordersRouted: local.ordersRouted,
      uniqueWallets: local.uniqueWallets,
      dryRuns: local.dryRuns,
      lastOrderAt: local.lastOrderAt,
      note: local.note,
    },
  });

  const { localRelay, emptyReason, summary, daily, builderId, fetchedAt } =
    bundle;
  return NextResponse.json(
    {
      builderId,
      summary,
      daily,
      emptyReason,
      fetchedAt,
      localRelay: {
        ordersRouted: localRelay.ordersRouted,
        uniqueWallets: localRelay.uniqueWallets,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
