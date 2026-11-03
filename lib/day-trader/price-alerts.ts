/**
 * Browser price alerts — adapted from day-trader-skill trader-alerts (MIT).
 * Client-side only; rings once until reset. Never places orders.
 */

export type AlertRule = {
  id: string;
  symbol: string;
  kind: "above" | "below" | "pct_move";
  price?: number;
  pct?: number;
  ref?: number;
  label: string;
  armed: boolean;
  firedAt?: string;
};

const KEY = "flowsentinel.dayTrader.alerts.v1";

export function loadAlerts(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AlertRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAlerts(rules: AlertRule[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(rules));
}

export function evaluateAlerts(
  rules: AlertRule[],
  quotes: Record<string, number>,
): { rules: AlertRule[]; fired: AlertRule[] } {
  const fired: AlertRule[] = [];
  const next = rules.map((r) => {
    if (!r.armed) return r;
    const px = quotes[r.symbol];
    if (px == null || !(px > 0)) return r;
    let hit = false;
    if (r.kind === "above" && r.price != null && px >= r.price) hit = true;
    if (r.kind === "below" && r.price != null && px <= r.price) hit = true;
    if (r.kind === "pct_move" && r.pct != null && r.ref != null && r.ref > 0) {
      const move = ((px - r.ref) / r.ref) * 100;
      if (Math.abs(move) >= r.pct) hit = true;
    }
    if (!hit) return r;
    const updated = { ...r, armed: false, firedAt: new Date().toISOString() };
    fired.push(updated);
    return updated;
  });
  return { rules: next, fired };
}
