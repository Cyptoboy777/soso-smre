/**
 * Budget / position sizer — adapted from day-trader-skill trader-budget (MIT).
 */

export type BudgetConfig = {
  budgetUsd: number;
  maxLossPerTradeUsd: number;
  maxPositionPct: number;
  maxOrderUsd: number;
  cashBufferPct: number;
  minOrderUsd: number;
  minRewardRisk: number;
};

export const DEFAULT_BUDGET: BudgetConfig = {
  budgetUsd: 5_000,
  maxLossPerTradeUsd: 50,
  maxPositionPct: 75,
  maxOrderUsd: 4_000,
  cashBufferPct: 10,
  minOrderUsd: 5,
  minRewardRisk: 1,
};

export type SizedTicket = {
  qty: number;
  notionalUsd: number;
  maxLossAtStop: number;
  limitingFactor: string;
  paperDefault: true;
};

export function sizePosition(opts: {
  entry: number;
  stop: number;
  target: number;
  side: "buy" | "sell";
  config?: Partial<BudgetConfig>;
}): SizedTicket {
  const cfg = { ...DEFAULT_BUDGET, ...opts.config };
  const long = opts.side === "buy";
  const risk = long ? opts.entry - opts.stop : opts.stop - opts.entry;
  if (!(risk > 0)) throw new Error("invalid risk");
  const rr =
    (long ? opts.target - opts.entry : opts.entry - opts.target) / risk;
  if (rr + 1e-9 < cfg.minRewardRisk) {
    throw new Error(
      `reward:risk ${rr.toFixed(2)} under min ${cfg.minRewardRisk}`,
    );
  }
  const byLoss = cfg.maxLossPerTradeUsd / risk;
  const byPos = (cfg.budgetUsd * (cfg.maxPositionPct / 100)) / opts.entry;
  const byOrder = cfg.maxOrderUsd / opts.entry;
  const cash = (cfg.budgetUsd * (1 - cfg.cashBufferPct / 100)) / opts.entry;
  const raw = Math.min(byLoss, byPos, byOrder, cash);
  // Crypto: allow fractional qty down to 6 dp, but never below min order notional
  let qty = Math.floor(raw * 1e6) / 1e6;
  if (qty * opts.entry < cfg.minOrderUsd) {
    throw new Error(
      `sized notional under min_order_usd (${cfg.minOrderUsd}) — stop too far for max loss`,
    );
  }
  const factors = [
    { name: "max_loss", v: byLoss },
    { name: "position_cap", v: byPos },
    { name: "max_order", v: byOrder },
    { name: "cash_buffer", v: cash },
  ];
  factors.sort((a, b) => a.v - b.v);
  return {
    qty,
    notionalUsd: Math.round(qty * opts.entry * 100) / 100,
    maxLossAtStop: Math.round(qty * risk * 100) / 100,
    limitingFactor: factors[0]!.name,
    paperDefault: true,
  };
}
