/**
 * Server-side guards for user-signed builder order relays.
 * Never trusts client notional / fee / structure alone.
 */
import { getBuilderConfig, type BuilderParams } from "@/lib/sodex-builder";

const MAX_BODY_ORDERS = 1;
const MAX_QTY = 1e9;

export type RelayOrderParamsCheck = { ok: true } | { ok: false; error: string };

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Re-validate signed batch params before relay.
 * Enforces single-order batches, size/notional cap, and builder fee match.
 */
export function assertRelayOrderParams(
  params: Record<string, unknown>,
): RelayOrderParamsCheck {
  const cfg = getBuilderConfig();
  const orders = params.orders;
  if (!Array.isArray(orders) || orders.length === 0) {
    return { ok: false, error: "Order batch is empty." };
  }
  if (orders.length > MAX_BODY_ORDERS) {
    return { ok: false, error: "Only one order per batch is allowed." };
  }

  const order = orders[0] as Record<string, unknown>;
  if (!order || typeof order !== "object") {
    return { ok: false, error: "Invalid order." };
  }

  const side = asFiniteNumber(order.side);
  const type = asFiniteNumber(order.type);
  if (side !== 1 && side !== 2) {
    return { ok: false, error: "Invalid order side." };
  }
  if (type !== 1 && type !== 2) {
    return { ok: false, error: "Invalid order type." };
  }

  const qty = asFiniteNumber(order.quantity);
  const funds = asFiniteNumber(order.funds);
  const price = asFiniteNumber(order.price);

  if (qty != null && (qty <= 0 || qty > MAX_QTY)) {
    return { ok: false, error: "Order size is out of range." };
  }
  if (funds != null && (funds <= 0 || funds > cfg.maxNotionalUsdc)) {
    return { ok: false, error: "Order size exceeds the app limit." };
  }

  // Limit: require price + quantity; notional = qty * price
  if (type === 1) {
    if (price == null || price <= 0 || qty == null || qty <= 0) {
      return { ok: false, error: "Limit orders need a valid price and size." };
    }
    const notional = qty * price;
    if (!Number.isFinite(notional) || notional > cfg.maxNotionalUsdc + 1e-9) {
      return { ok: false, error: "Order size exceeds the app limit." };
    }
  }

  // Market buy uses funds; market sell uses quantity (base) — still cap funds path.
  if (type === 2 && side === 1) {
    if (funds == null || funds <= 0) {
      return { ok: false, error: "Market buys need a valid quote size." };
    }
    if (funds > cfg.maxNotionalUsdc + 1e-9) {
      return { ok: false, error: "Order size exceeds the app limit." };
    }
  }

  const builder = params.builder as BuilderParams | undefined;
  if (cfg.builderId != null) {
    if (!builder || builder.id !== cfg.builderId) {
      return { ok: false, error: "This order could not be verified." };
    }
    if (typeof builder.fee !== "number" || builder.fee !== cfg.builderFee) {
      return { ok: false, error: "This order could not be verified." };
    }
    if (builder.fee < 0 || builder.fee > cfg.maxApproval) {
      return { ok: false, error: "This order could not be verified." };
    }
  } else if (builder) {
    return { ok: false, error: "This order could not be verified." };
  }

  const accountID = asFiniteNumber(params.accountID);
  if (accountID == null || !Number.isSafeInteger(accountID) || accountID <= 0) {
    return { ok: false, error: "Invalid account." };
  }

  return { ok: true };
}

/** Reject oversized JSON request bodies early. */
export async function readJsonBodyLimited(
  req: Request,
  maxBytes = 32_768,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const raw = await req.text();
  if (raw.length > maxBytes) {
    return { ok: false, error: "Request is too large." };
  }
  try {
    return { ok: true, value: raw ? JSON.parse(raw) : {} };
  } catch {
    return { ok: false, error: "Invalid request body." };
  }
}
