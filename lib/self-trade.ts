/** Block a new order that would cross the same account's resting order. */

export type RestingOrder = {
  side: "buy" | "sell";
  price: number | null;
  status: string;
};

const OPEN = new Set(["NEW", "OPEN", "LIVE", "PARTIALLY_FILLED", "PARTIAL", "open", "partial"]);

export function selfTradeCheck(input: {
  side: "buy" | "sell";
  type: "limit" | "market";
  price?: number | null;
  resting: RestingOrder[];
  bookKnown: boolean;
}): { state: "clear" | "blocked" | "unavailable"; detail: string } {
  if (!input.bookKnown) {
    return {
      state: "unavailable",
      detail:
        "Open orders could not be read. This desk still sends only the single order you sign. It does not quote the other side.",
    };
  }
  const open = input.resting.filter((order) => OPEN.has(order.status.trim().toUpperCase()));
  const opposite = open.filter((order) => order.side !== input.side);
  if (opposite.some((order) => order.price == null)) {
    return {
      state: "unavailable",
      detail: "A resting order has no price, so a cross could not be ruled out.",
    };
  }
  const blocked = opposite.some((order) => {
    if (input.type === "market") return true;
    if (input.price == null || order.price == null) return false;
    return input.side === "buy" ? input.price >= order.price : input.price <= order.price;
  });
  if (blocked) {
    return {
      state: "blocked",
      detail: "This order would cross your own resting order. It was not prepared.",
    };
  }
  return {
    state: "clear",
    detail: "No cross with your visible resting orders.",
  };
}
