/**
 * Honest Builder Race usage metrics — only records real relayed activity.
 * Never invents volume or fees. File-backed; skipped on read-only hosts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export type BuilderMetricsSnapshot = {
  ordersRouted: number;
  uniqueWallets: number;
  dryRuns: number;
  lastOrderAt: string | null;
  wallets: string[];
};

const EMPTY: BuilderMetricsSnapshot = {
  ordersRouted: 0,
  uniqueWallets: 0,
  dryRuns: 0,
  lastOrderAt: null,
  wallets: [],
};

function metricsPath(): string {
  return (
    process.env.BUILDER_METRICS_PATH?.trim() ||
    join(process.cwd(), ".data", "builder-metrics.json")
  );
}

function load(): BuilderMetricsSnapshot {
  try {
    const p = metricsPath();
    if (!existsSync(p)) return { ...EMPTY, wallets: [] };
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<BuilderMetricsSnapshot>;
    const wallets = Array.isArray(raw.wallets)
      ? raw.wallets.map((w) => String(w).toLowerCase()).filter((w) => /^0x[0-9a-f]{40}$/.test(w))
      : [];
    return {
      ordersRouted: Number(raw.ordersRouted) || 0,
      uniqueWallets: wallets.length,
      dryRuns: Number(raw.dryRuns) || 0,
      lastOrderAt: raw.lastOrderAt ? String(raw.lastOrderAt) : null,
      wallets,
    };
  } catch {
    return { ...EMPTY, wallets: [] };
  }
}

function save(snap: BuilderMetricsSnapshot): void {
  try {
    const p = metricsPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(
      p,
      JSON.stringify(
        {
          ordersRouted: snap.ordersRouted,
          uniqueWallets: snap.wallets.length,
          dryRuns: snap.dryRuns,
          lastOrderAt: snap.lastOrderAt,
          wallets: snap.wallets,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  } catch (e) {
    console.warn("[builder-metrics] persist failed", e instanceof Error ? e.message : e);
  }
}

export function readBuilderMetrics(): Omit<BuilderMetricsSnapshot, "wallets"> & {
  note: string;
} {
  const s = load();
  return {
    ordersRouted: s.ordersRouted,
    uniqueWallets: s.wallets.length,
    dryRuns: s.dryRuns,
    lastOrderAt: s.lastOrderAt,
    note: "Counts only confirmed orders relayed by this app. Not protocol fee revenue.",
  };
}

export function recordDryRun(): void {
  const s = load();
  s.dryRuns += 1;
  save(s);
}

export function recordRoutedOrder(wallet: string): void {
  const addr = wallet.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return;
  const s = load();
  s.ordersRouted += 1;
  if (!s.wallets.includes(addr)) s.wallets.push(addr);
  s.uniqueWallets = s.wallets.length;
  s.lastOrderAt = new Date().toISOString();
  save(s);
}
