/**
 * Parse a SoDEX batch place/cancel response.
 * Top-level code and each item code must be read. An order id means accepted, not filled.
 * Docs: spot batch response in sodex-rest-spot-api.md
 */

export type ReceiptStage = "accepted" | "rejected" | "partial" | "ambiguous";

export type ReceiptItem = {
  stage: "accepted" | "rejected" | "ambiguous";
  orderId: string | null;
  clientOrderId: string | null;
};

export type ExecutionReceipt = {
  stage: ReceiptStage;
  orderId: string | null;
  clientOrderId: string | null;
  items: ReceiptItem[];
  message: string;
  /** Never resubmit an ambiguous or partial request with a fresh nonce. */
  retryAllowed: false;
  filled: false;
};

function asId(value: unknown): string | null {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

function asClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[0-9a-zA-Z_-]{1,36}$/.test(value) ? value : null;
}

function rowsFrom(raw: unknown): Array<Record<string, unknown>> {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data;
  if (Array.isArray(data)) {
    return data.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  }
  if (data && typeof data === "object") {
    const nested = data as { orders?: unknown; results?: unknown };
    const list = Array.isArray(nested.orders)
      ? nested.orders
      : Array.isArray(nested.results)
        ? nested.results
        : [data];
    return list.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  }
  return [];
}

export function parseBatchReceipt(raw: unknown): ExecutionReceipt {
  const ambiguous = (message: string): ExecutionReceipt => ({
    stage: "ambiguous",
    orderId: null,
    clientOrderId: null,
    items: [],
    message,
    retryAllowed: false,
    filled: false,
  });

  if (!raw || typeof raw !== "object") {
    return ambiguous(
      "The exchange response was incomplete. Reconcile this order before sending another. Acceptance was not confirmed.",
    );
  }

  const top = (raw as { code?: unknown }).code;
  if (typeof top === "number" && top !== 0) {
    return {
      stage: "rejected",
      orderId: null,
      clientOrderId: null,
      items: [],
      message: "The exchange rejected the request. No fill was recorded.",
      retryAllowed: false,
      filled: false,
    };
  }
  if (typeof top !== "number") {
    return ambiguous(
      "The exchange did not return a status code. Do not send the order again until you reconcile it.",
    );
  }

  const rows = rowsFrom(raw);
  if (!rows.length) {
    return ambiguous(
      "The exchange accepted the batch envelope but returned no order result. Reconcile before retrying.",
    );
  }

  const items: ReceiptItem[] = rows.map((row) => {
    const clientOrderId = asClientId(row.clOrdID ?? row.clOrdId);
    if (typeof row.code !== "number") return { stage: "ambiguous" as const, orderId: null, clientOrderId };
    if (row.code !== 0) return { stage: "rejected" as const, orderId: null, clientOrderId };
    const orderId = asId(row.orderID ?? row.orderId);
    if (!orderId) return { stage: "ambiguous" as const, orderId: null, clientOrderId };
    return { stage: "accepted" as const, orderId, clientOrderId };
  });
  const accepted = items.filter((item) => item.stage === "accepted");
  const rejected = items.filter((item) => item.stage === "rejected");
  const unclear = items.filter((item) => item.stage === "ambiguous");
  const first = items[0];
  if (unclear.length) {
    return {
      stage: "ambiguous",
      orderId: first.orderId,
      clientOrderId: first.clientOrderId,
      items,
      message: "Part of the response had no order id. Reconcile every line before sending anything else.",
      retryAllowed: false,
      filled: false,
    };
  }
  if (accepted.length && rejected.length) {
    return {
      stage: "partial",
      orderId: accepted[0]?.orderId ?? null,
      clientOrderId: accepted[0]?.clientOrderId ?? null,
      items,
      message: "Some orders were accepted and some were rejected. Acceptance is not a fill. Do not resend the batch.",
      retryAllowed: false,
      filled: false,
    };
  }
  if (rejected.length) {
    return {
      stage: "rejected",
      orderId: null,
      clientOrderId: first.clientOrderId,
      items,
      message: "The exchange rejected this order. No fill was recorded.",
      retryAllowed: false,
      filled: false,
    };
  }
  return {
    stage: "accepted",
    orderId: first.orderId,
    clientOrderId: first.clientOrderId,
    items,
    message: "Accepted by the exchange. Acceptance is not a fill.",
    retryAllowed: false,
    filled: false,
  };
}

export type ReconciledStatus =
  | "open"
  | "partial"
  | "filled"
  | "cancelled"
  | "expired"
  | "rejected"
  | "unknown";

export function mapVenueStatus(status: string): ReconciledStatus {
  const key = status.trim().toUpperCase().replace(/\s+/g, "_");
  if (key === "NEW" || key === "OPEN" || key === "LIVE") return "open";
  if (key === "PARTIALLY_FILLED" || key === "PARTIAL") return "partial";
  if (key === "FILLED") return "filled";
  if (key === "CANCELED" || key === "CANCELLED") return "cancelled";
  if (key === "EXPIRED") return "expired";
  if (key === "REJECTED") return "rejected";
  return "unknown";
}
