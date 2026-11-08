/**
 * Public account reads by wallet address. No API key. No raw payloads returned.
 * Spot routes only. Docs: sodex-rest-spot-api.md account queries.
 */
import { spotApiBase, type SodexNetworkLabel } from "@/lib/sodex-builder";
import { mapVenueStatus, type ReconciledStatus } from "@/lib/order-receipt";
import type { RestingOrder } from "@/lib/self-trade";

export type PublicOrder = {
  orderId: string | null;
  clientOrderId: string | null;
  side: "buy" | "sell" | null;
  price: number | null;
  quantity: number | null;
  status: ReconciledStatus;
  venueStatus: string | null;
};

export type PublicBalance = {
  asset: string;
  total: string;
  locked: string | null;
};

async function readJson(url: string): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { code?: number; data?: unknown };
    if (typeof body.code === "number" && body.code !== 0) return { ok: false };
    return { ok: true, data: body.data ?? body };
  } catch {
    return { ok: false };
  }
}

function asRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  for (const key of ["orders", "list", "balances", "items"]) {
    if (Array.isArray(obj[key])) return asRows(obj[key]);
  }
  return [];
}

function sideOf(value: unknown): "buy" | "sell" | null {
  if (value === 1 || value === "1" || String(value).toUpperCase() === "BUY") return "buy";
  if (value === 2 || value === "2" || String(value).toUpperCase() === "SELL") return "sell";
  return null;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

export function parsePublicOrders(data: unknown): PublicOrder[] {
  return asRows(data).map((row) => {
    const venueStatus = typeof row.status === "string" ? row.status : typeof row.st === "string" ? row.st : null;
    return {
      orderId: idOf(row.orderID ?? row.orderId ?? row.i),
      clientOrderId:
        typeof (row.clOrdID ?? row.clOrdId) === "string" ? String(row.clOrdID ?? row.clOrdId) : null,
      side: sideOf(row.side ?? row.S),
      price: num(row.price ?? row.p),
      quantity: num(row.quantity ?? row.q ?? row.origQty),
      status: mapVenueStatus(venueStatus ?? ""),
      venueStatus,
    };
  });
}

export function parsePublicBalances(data: unknown): PublicBalance[] | null {
  const rows = asRows(data);
  if (!rows.length) return [];
  const parsed: PublicBalance[] = [];
  for (const row of rows) {
    const asset = row.a ?? row.asset ?? row.coin ?? row.name;
    const total = row.t ?? row.total ?? row.free;
    if (typeof asset !== "string" || !asset.trim()) return null;
    if (typeof total !== "string" && typeof total !== "number") return null;
    const locked = row.l ?? row.locked;
    parsed.push({
      asset: asset.trim(),
      total: String(total),
      locked: locked == null ? null : String(locked),
    });
  }
  return parsed;
}

function accountQuery(network: SodexNetworkLabel, address: string, path: string, accountId?: number): string {
  const url = new URL(`${spotApiBase(network)}/accounts/${address.toLowerCase()}/${path}`);
  if (accountId && Number.isSafeInteger(accountId)) url.searchParams.set("accountID", String(accountId));
  return url.toString();
}

export async function readSpotOrders(
  network: SodexNetworkLabel,
  address: string,
  accountId?: number,
): Promise<{ available: boolean; open: PublicOrder[]; history: PublicOrder[] }> {
  const historyUrl = new URL(accountQuery(network, address, "orders/history", accountId));
  historyUrl.searchParams.set("limit", "50");
  const [openRes, histRes] = await Promise.all([
    readJson(accountQuery(network, address, "orders", accountId)),
    readJson(historyUrl.toString()),
  ]);
  if (!openRes.ok && !histRes.ok) return { available: false, open: [], history: [] };
  return {
    available: true,
    open: openRes.ok ? parsePublicOrders(openRes.data) : [],
    history: histRes.ok ? parsePublicOrders(histRes.data) : [],
  };
}

export async function readSpotBalances(
  network: SodexNetworkLabel,
  address: string,
  accountId?: number,
): Promise<{ available: boolean; balances: PublicBalance[] }> {
  const res = await readJson(accountQuery(network, address, "balances", accountId));
  if (!res.ok) return { available: false, balances: [] };
  const balances = parsePublicBalances(res.data);
  if (balances == null) return { available: false, balances: [] };
  return { available: true, balances };
}

export function restingFrom(orders: PublicOrder[]): RestingOrder[] {
  return orders
    .filter((order) => order.side)
    .map((order) => ({
      side: order.side as "buy" | "sell",
      price: order.price,
      status: order.venueStatus ?? order.status,
    }));
}
