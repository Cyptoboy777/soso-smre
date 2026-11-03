import { NextResponse } from "next/server";
import { runDayTraderWorkflow } from "@/lib/day-trader/workflow";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";
import { isAllowedTradeSymbol } from "@/lib/trade-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `day-trader:${ip}`,
    20,
    60 * 60_000,
    "Rate limit: day-trader workflow",
  );
  if (limited) return limited;

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  if (symbol && !isAllowedTradeSymbol(symbol)) {
    return NextResponse.json({ error: "Symbol not allowlisted" }, { status: 400 });
  }
  const replays = Number(url.searchParams.get("replays") ?? 10000);
  const seed = Number(url.searchParams.get("seed") ?? 19);

  try {
    const result = await runDayTraderWorkflow({
      symbol: symbol || undefined,
      replays: Number.isFinite(replays) ? Math.min(Math.max(replays, 100), 10_000) : 10_000,
      seed: Number.isFinite(seed) ? seed : 19,
      budgetUsd: Number(url.searchParams.get("budget") ?? 5000) || 5000,
      maxLossUsd: Number(url.searchParams.get("maxLoss") ?? 50) || 50,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
