/**
 * Read-only SoDEX builder fee statistics (public endpoints, no signature).
 * Docs: Query Builder Fee Summary / Daily Chart
 *   GET /api/v1/user/{owner}/builder/summary?accountID=
 *   GET /api/v1/user/{owner}/builder/daily-chart?accountID=&limit=
 *
 * Never invents numbers. Callers must show empty state when data is null/empty.
 */

import {
  getBuilderConfig,
  publicApiBase,
  type SodexNetworkLabel,
} from "@/lib/sodex-builder";

export type BuilderFeeStats = {
  address?: string;
  name: string;
  builderCode: string;
  userCount: string;
  builderFee: string;
  tradeCount: string;
  tradeVolume: string;
};

export type BuilderFeeDailyStats = {
  date: string;
  userCount: string;
  builderFee: string;
  tradeCount: string;
  tradeVolume: string;
};

export type BuilderFeeStatsBundle = {
  network: SodexNetworkLabel;
  builderId: number | null;
  ownerAddress: string | null;
  summary: BuilderFeeStats | null;
  daily: BuilderFeeDailyStats[];
  source: string;
  fetchedAt: string;
  emptyReason: string | null;
  localRelay: {
    ordersRouted: number;
    uniqueWallets: number;
    dryRuns: number;
    lastOrderAt: string | null;
    note: string;
  };
};

function isHexAddress(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

export function getBuilderOwnerAddress(): string | null {
  const raw = process.env.SODEX_BUILDER_ADDRESS?.trim();
  if (!raw || !isHexAddress(raw)) return null;
  return raw.toLowerCase();
}

function asString(v: unknown, fallback = "0"): string {
  if (v == null) return fallback;
  return String(v);
}

function parseSummary(raw: unknown): BuilderFeeStats | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.name == null && o.builderCode == null && o.builderFee == null) return null;
  return {
    address: o.address ? String(o.address) : undefined,
    name: asString(o.name, "Builder"),
    builderCode: asString(o.builderCode, ""),
    userCount: asString(o.userCount, "0"),
    builderFee: asString(o.builderFee, "0"),
    tradeCount: asString(o.tradeCount, "0"),
    tradeVolume: asString(o.tradeVolume, "0"),
  };
}

function parseDaily(raw: unknown): BuilderFeeDailyStats[] {
  if (!Array.isArray(raw)) return [];
  const out: BuilderFeeDailyStats[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const date = asString(o.date, "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      date,
      userCount: asString(o.userCount, "0"),
      builderFee: asString(o.builderFee, "0"),
      tradeCount: asString(o.tradeCount, "0"),
      tradeVolume: asString(o.tradeVolume, "0"),
    });
  }
  return out;
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ code?: number; data?: unknown; error?: string }> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let json: { code?: number; data?: unknown; error?: string } = {};
  try {
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch {
    throw new Error(`SoDEX fee-stats non-JSON (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(json.error || `SoDEX fee-stats HTTP ${res.status}`);
  }
  return json;
}

/**
 * Fetch protocol-reported builder fee summary + daily chart.
 * Prefers mainnet public stats (leaderboard source of truth) when an owner
 * address is configured; falls back to the active builder network.
 */
export async function fetchBuilderFeeStatsBundle(opts?: {
  network?: SodexNetworkLabel;
  limit?: number;
  localRelay?: BuilderFeeStatsBundle["localRelay"];
}): Promise<BuilderFeeStatsBundle> {
  const cfg = getBuilderConfig();
  const owner = getBuilderOwnerAddress();
  const network: SodexNetworkLabel = opts?.network ?? "mainnet";
  const limit = Math.min(300, Math.max(1, opts?.limit ?? 90));
  const localRelay = opts?.localRelay ?? {
    ordersRouted: 0,
    uniqueWallets: 0,
    dryRuns: 0,
    lastOrderAt: null,
    note: "Local relay counts unavailable.",
  };

  const base: BuilderFeeStatsBundle = {
    network,
    builderId: cfg.builderId,
    ownerAddress: owner,
    summary: null,
    daily: [],
    source: "SoDEX public builder stats",
    fetchedAt: new Date().toISOString(),
    emptyReason: null,
    localRelay,
  };

  if (!owner) {
    return {
      ...base,
      emptyReason:
        "Builder revenue stats are not configured yet.",
    };
  }
  if (!cfg.builderId) {
    return {
      ...base,
      emptyReason:
        "Builder revenue stats are not available yet.",
    };
  }

  const root = publicApiBase(network);
  const q = new URLSearchParams({
    accountID: String(cfg.builderId),
  });
  const dailyQ = new URLSearchParams({
    accountID: String(cfg.builderId),
    limit: String(limit),
  });

  try {
    const [summaryRes, dailyRes] = await Promise.all([
      fetchJson(`${root}/user/${owner}/builder/summary?${q}`),
      fetchJson(`${root}/user/${owner}/builder/daily-chart?${dailyQ}`),
    ]);

    const summary =
      summaryRes.code === 0 ? parseSummary(summaryRes.data) : null;
    const daily =
      dailyRes.code === 0 ? parseDaily(dailyRes.data) : [];

    let emptyReason: string | null = null;
    if (!summary && daily.length === 0) {
      emptyReason =
        "No fee activity yet. Numbers appear after real users trade.";
    }

    return {
      ...base,
      summary,
      daily,
      emptyReason,
      source: "SoDEX public builder stats",
    };
  } catch (e) {
    return {
      ...base,
      emptyReason:
        "Could not load builder revenue right now. Please try again shortly.",
    };
  }
}

/** Format a decimal string for display without inventing precision. */
export function formatStatNumber(raw: string, opts?: { maxFrac?: number }): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw || "—";
  const maxFrac = opts?.maxFrac ?? 4;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFrac,
  }).format(n);
}
