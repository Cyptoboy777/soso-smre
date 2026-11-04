/**
 * Risk Manager — adapted from day-trader-skill trader-risk (MIT).
 * Gates the order ticket. PASS or BLOCK with reasons.
 */

export type RiskLimits = {
  maxLossPerTradeUsd: number;
  maxDailyLossUsd: number;
  maxTradesPerDay: number;
  minRewardRisk: number;
  requireStop: boolean;
  maxNotionalUsd: number;
  paperDefault: boolean;
};

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxLossPerTradeUsd: 50,
  maxDailyLossUsd: 150,
  maxTradesPerDay: 3,
  minRewardRisk: 1,
  requireStop: true,
  maxNotionalUsd: 10, // FlowSentinel per-order cap alignment
  paperDefault: true,
};

export type RiskTicket = {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  entry: number;
  stop: number | null;
  target: number | null;
  notionalUsd: number;
};

export type RiskVerdict = {
  status: "PASS" | "BLOCK";
  reasons: string[];
  warnings: string[];
  maxLossUsd: number | null;
  rewardRisk: number | null;
  paperMode: true;
};

export function checkTicket(
  ticket: RiskTicket,
  limits: Partial<RiskLimits> = {},
  ctx: { tradesToday?: number; dailyLossBudgetUsed?: number } = {},
): RiskVerdict {
  const L = { ...DEFAULT_RISK_LIMITS, ...limits };
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!(ticket.qty > 0) || !(ticket.entry > 0)) {
    reasons.push("format: qty and entry must be positive");
  }
  if (ticket.notionalUsd > L.maxNotionalUsd + 1e-9) {
    reasons.push(
      `size: notional $${ticket.notionalUsd.toFixed(2)} over max_order_usd $${L.maxNotionalUsd}`,
    );
  }
  if (L.requireStop && (ticket.stop == null || !(ticket.stop > 0))) {
    reasons.push("stop: require_stop is on and no stop was set");
  }

  let maxLossUsd: number | null = null;
  let rewardRisk: number | null = null;
  if (ticket.stop != null && ticket.stop > 0) {
    const long = ticket.side === "buy";
    const riskPer = long ? ticket.entry - ticket.stop : ticket.stop - ticket.entry;
    if (!(riskPer > 0)) {
      reasons.push("stop: stop is on the wrong side of entry");
    } else {
      maxLossUsd = Math.round(ticket.qty * riskPer * 100) / 100;
      if (maxLossUsd > L.maxLossPerTradeUsd + 1e-9) {
        reasons.push(
          `loss: max loss at stop $${maxLossUsd} over max_loss_per_trade_usd $${L.maxLossPerTradeUsd}`,
        );
      }
      if (ticket.target != null) {
        const reward = long
          ? ticket.target - ticket.entry
          : ticket.entry - ticket.target;
        rewardRisk = reward / riskPer;
        if (rewardRisk + 1e-9 < L.minRewardRisk) {
          reasons.push(
            `reward:risk ${rewardRisk.toFixed(2)} under min_reward_risk ${L.minRewardRisk}`,
          );
        }
      }
    }
  }

  const tradesToday = ctx.tradesToday ?? 0;
  if (tradesToday >= L.maxTradesPerDay) {
    reasons.push(
      `trades: already ${tradesToday} entries today (max ${L.maxTradesPerDay})`,
    );
  }
  const used = ctx.dailyLossBudgetUsed ?? 0;
  if (maxLossUsd != null && used + maxLossUsd > L.maxDailyLossUsd + 1e-9) {
    reasons.push(
      `daily loss: $${(used + maxLossUsd).toFixed(2)} would exceed max_daily_loss_usd $${L.maxDailyLossUsd}`,
    );
  }

  warnings.push(
    "Paper mode is the default. Nothing submits without your explicit yes on the Builder Codes confirm screen.",
  );

  return {
    status: reasons.length ? "BLOCK" : "PASS",
    reasons,
    warnings,
    maxLossUsd,
    rewardRisk,
    paperMode: true,
  };
}
