/**
 * Reviewed grid of resting limits. Two sides are allowed when they do not cross.
 * This plans an order list for one signature. It does not run, refresh, or cancel later.
 */

export type GridOrder = {
  side: "buy" | "sell";
  price: string;
  quantity: string;
};

function trimDecimal(value: number, digits: number): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error("The grid needs a live reference price.");
  const text = value.toFixed(digits);
  return text.replace(/\.?0+$/, "");
}

export function planGrid(input: {
  mid: number;
  levelsEachSide: number;
  spacingBps: number;
  quantity: string;
  priceDigits?: number;
}): GridOrder[] {
  if (!Number.isInteger(input.levelsEachSide) || input.levelsEachSide < 1 || input.levelsEachSide > 3) {
    throw new Error("Choose 1 to 3 levels on each side.");
  }
  if (!Number.isFinite(input.spacingBps) || input.spacingBps <= 0 || input.spacingBps > 500) {
    throw new Error("Spacing must be greater than zero so the two sides do not cross.");
  }
  if (!/^\d+(\.\d+)?$/.test(input.quantity) || Number(input.quantity) <= 0) {
    throw new Error("Enter a size for each grid order.");
  }
  const digits = input.priceDigits ?? 2;
  const orders: GridOrder[] = [];
  for (let level = 1; level <= input.levelsEachSide; level += 1) {
    const bid = input.mid * (1 - (input.spacingBps * level) / 10_000);
    const ask = input.mid * (1 + (input.spacingBps * level) / 10_000);
    orders.push({ side: "buy", price: trimDecimal(bid, digits), quantity: input.quantity });
    orders.push({ side: "sell", price: trimDecimal(ask, digits), quantity: input.quantity });
  }
  if (gridCrosses(orders)) {
    throw new Error("These grid prices cross. Widen the spacing.");
  }
  return orders;
}

export function gridCrosses(orders: Array<{ side: "buy" | "sell"; price: string }>): boolean {
  let maxBuy = 0;
  let minSell = Number.POSITIVE_INFINITY;
  for (const order of orders) {
    const price = Number(order.price);
    if (!Number.isFinite(price) || price <= 0) return true;
    if (order.side === "buy") maxBuy = Math.max(maxBuy, price);
    else minSell = Math.min(minSell, price);
  }
  return maxBuy > 0 && minSell < Number.POSITIVE_INFINITY && maxBuy >= minSell;
}
