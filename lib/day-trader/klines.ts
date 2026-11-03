/**
 * Paginated SoDEX 5m klines for Time Machine / scanner (public, free).
 */
import type { Bar } from "@/lib/day-trader/scanner";

const TESTNET = "https://testnet-gw.sodex.dev";
const MAINNET = "https://mainnet-gw.sodex.dev";

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function getPage(
  base: string,
  symbol: string,
  interval: string,
  limit: number,
  endTime?: number,
): Promise<Bar[]> {
  const q = new URLSearchParams({
    interval,
    limit: String(limit),
  });
  if (endTime != null) q.set("endTime", String(endTime));
  const path = `/api/v1/spot/markets/${encodeURIComponent(symbol)}/klines?${q}`;
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { code?: number; data?: unknown };
  if (typeof body.code === "number" && body.code !== 0) return [];
  const rows = Array.isArray(body.data) ? body.data : [];
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return { t: n(x.t), o: n(x.o), h: n(x.h), l: n(x.l), c: n(x.c), v: n(x.v) };
  });
}

/** Fetch up to `maxBars` of interval bars, paging backward via endTime. */
export async function fetchKlinesPaged(opts: {
  symbol: string;
  interval?: string;
  maxBars?: number;
}): Promise<{ bars: Bar[]; gateway: "testnet" | "mainnet" | "fallback" }> {
  const interval = opts.interval ?? "5m";
  const maxBars = opts.maxBars ?? 5000;
  const pageSize = 1000;

  for (const gateway of ["testnet", "mainnet"] as const) {
    const base = gateway === "testnet" ? TESTNET : MAINNET;
    const all: Bar[] = [];
    let endTime: number | undefined;
    for (let page = 0; page < 12 && all.length < maxBars; page++) {
      const chunk = await getPage(base, opts.symbol, interval, pageSize, endTime);
      if (!chunk.length) break;
      all.push(...chunk);
      const oldest = Math.min(...chunk.map((b) => b.t));
      if (!(oldest > 0) || chunk.length < pageSize) break;
      endTime = oldest - 1;
    }
    if (all.length) {
      const uniq = new Map<number, Bar>();
      for (const b of all) {
        if (b.t > 0 && b.c > 0) uniq.set(b.t, b);
      }
      const bars = [...uniq.values()].sort((a, b) => a.t - b.t);
      return { bars, gateway };
    }
  }
  return { bars: [], gateway: "fallback" };
}

/** Daily closes from 1d klines (complete bars only). */
export async function fetchDailyCloses(symbol: string): Promise<{
  closes: number[];
  gateway: "testnet" | "mainnet" | "fallback";
}> {
  const { bars, gateway } = await fetchKlinesPaged({
    symbol,
    interval: "1d",
    maxBars: 120,
  });
  return { closes: bars.map((b) => b.c), gateway };
}
