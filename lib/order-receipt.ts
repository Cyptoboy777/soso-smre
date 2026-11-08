/**
 * Parse a SoDEX batch place/cancel response.
 * Top-level code and each item code must be read. An order id means accepted, not filled.
 * Docs: spot batch response in sodex-rest-spot-api.md
 */

export type ReceiptStage = "accepted" | "rejected" | "ambiguous";

export type ExecutionReceipt = {
  stage: ReceiptStage;
  orderId: string | null;
  clientOrderId: string | null;
  message: string;
  /** Never resubmit an ambiguous request with a fresh nonce. */
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
  const row = rows[0];
  if (!row) {
    return ambiguous(
      "The exchange accepted the batch envelope but returned no order result. Reconcile before retrying.",
    );
  }

  const itemCode = row.code;
  const clientOrderId = asClientId(row.clOrdID ?? row.clOrdId);
  if (typeof itemCode === "number" && itemCode !== 0) {
    return {
      stage: "rejected",
      orderId: null,
      clientOrderId,
      message: "The exchange rejected this order. No fill was recorded.",
      retryAllowed: false,
      filled: false,
    };
  }
  if (typeof itemCode !== "number") {
    return ambiguous(
      "An order result arrived without a status code. Do not send it again until you reconcile it.",
    );
  }

  const orderId = asId(row.orderID ?? row.orderId);
  if (!orderId) {
    return {
      stage: "ambiguous",
      orderId: null,
      clientOrderId,
      message:
        "The exchange returned success without an order id. Reconcile before sending another order.",
      retryAllowed: false,
      filled: false,
    };
  }

  return {
    stage: "accepted",
    orderId,
    clientOrderId,
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
