/**
 * Pre-trade cost from a real order book. Scenarios are arithmetic, not forecasts,
 * backtests, or profit claims. Spot buy app fee follows SoDEX builder-code docs:
 * builder fees do not apply to the buying side of spot.
 */

export type BookLevel = { price: number; qty: number };

export type CostLine = {
  label: string;
  amount: string | null;
  state: "estimated" | "unavailable" | "not-charged";
  detail: string;
};

export type StressRow = {
  label: string;
  state: "scenario" | "unavailable";
  detail: string;
};

export type CostLens = {
  state: "ready" | "stale" | "unavailable";
  mid: number | null;
  spreadBps: number | null;
  imbalance: number | null;
  averagePrice: number | null;
  slippageBps: number | null;
  filledBase: number | null;
  quoteUsed: number | null;
  complete: boolean;
  resting: boolean;
  lines: CostLine[];
  stress: StressRow[];
  withinBudget: boolean | null;
  budgetDetail: string;
};

const STALE_MS = 20_000;

function finite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function quoteAgeMs(fetchedAt: string | null | undefined, now = Date.now()): number | null {
  if (!fetchedAt) return null;
  const time = Date.parse(fetchedAt);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, now - time);
}

export function quoteIsStale(fetchedAt: string | null | undefined, now = Date.now()): boolean {
  const age = quoteAgeMs(fetchedAt, now);
  return age == null || age > STALE_MS;
}

/** Requested app fee in quote units. 10 tenths of a bp = 0.01% = notional / 100000 * 10. */
export function requestedAppFee(notional: number, feeTenths: number, side: "buy" | "sell"): number {
  if (side === "buy") return 0;
  if (!finite(notional) || !Number.isFinite(feeTenths) || feeTenths <= 0) return 0;
  return (notional * feeTenths) / 100_000;
}

function walk(
  levels: BookLevel[],
  baseQty: number,
  limitPrice: number | null,
  side: "buy" | "sell",
): { filled: number; quote: number; complete: boolean } {
  let remain = baseQty;
  let quote = 0;
  let filled = 0;
  for (const level of levels) {
    if (!finite(level.price) || !finite(level.qty)) continue;
    if (limitPrice != null) {
      if (side === "buy" && level.price > limitPrice) break;
      if (side === "sell" && level.price < limitPrice) break;
    }
    const take = Math.min(remain, level.qty);
    filled += take;
    quote += take * level.price;
    remain -= take;
    if (remain <= 1e-12) break;
  }
  return { filled, quote, complete: remain <= 1e-12 };
}

export function buildCostLens(input: {
  side: "buy" | "sell";
  type: "limit" | "market";
  /** Base quantity, or quote funds for a spot market buy. */
  quantity: number;
  price?: number | null;
  bids: BookLevel[];
  asks: BookLevel[];
  fetchedAt?: string | null;
  now?: number;
  includeAppFee: boolean;
  feeTenths: number;
  budgetUsdc?: number | null;
  /** Exchange maker/taker schedule. Null until a documented fee-rate payload is parsed. */
  exchangeFeeQuote?: number | null;
}): CostLens {
  const now = input.now ?? Date.now();
  const stale = quoteIsStale(input.fetchedAt, now);
  const bestBid = input.bids.find((level) => finite(level.price))?.price ?? null;
  const bestAsk = input.asks.find((level) => finite(level.price))?.price ?? null;
  const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk;
  const spreadBps =
    mid && bestBid != null && bestAsk != null ? ((bestAsk - bestBid) / mid) * 10_000 : null;
  const bidQty = input.bids.reduce((sum, level) => sum + (finite(level.qty) ? level.qty : 0), 0);
  const askQty = input.asks.reduce((sum, level) => sum + (finite(level.qty) ? level.qty : 0), 0);
  const imbalance = bidQty + askQty > 0 ? bidQty / (bidQty + askQty) : null;

  const empty: CostLens = {
    state: input.bids.length + input.asks.length === 0 ? "unavailable" : stale ? "stale" : "ready",
    mid,
    spreadBps,
    imbalance,
    averagePrice: null,
    slippageBps: null,
    filledBase: null,
    quoteUsed: null,
    complete: false,
    resting: false,
    lines: [],
    stress: [],
    withinBudget: null,
    budgetDetail: "No size to compare with the risk budget.",
  };

  if (!finite(input.quantity) || mid == null) {
    empty.state = "unavailable";
    empty.lines = [
      {
        label: "Book impact",
        amount: null,
        state: "unavailable",
        detail: "A live book or a valid size was not available, so impact was not estimated.",
      },
    ];
    empty.stress = [
      {
        label: "Adverse price",
        state: "unavailable",
        detail: "No reference price, so an adverse scenario was not calculated.",
      },
      {
        label: "Funding",
        state: "unavailable",
        detail: "This ticket is spot. A perps funding scenario is not applied.",
      },
    ];
    return empty;
  }

  const bookSide = input.side === "buy" ? input.asks : input.bids;
  const marketBuy = input.type === "market" && input.side === "buy";
  let filled = 0;
  let quote = 0;
  let complete = false;
  let resting = false;

  if (marketBuy) {
    let remainQuote = input.quantity;
    for (const level of bookSide) {
      if (!finite(level.price) || !finite(level.qty)) continue;
      const levelQuote = level.price * level.qty;
      const takeQuote = Math.min(remainQuote, levelQuote);
      filled += takeQuote / level.price;
      quote += takeQuote;
      remainQuote -= takeQuote;
      if (remainQuote <= 1e-8) break;
    }
    complete = remainQuote <= 1e-8;
  } else if (input.type === "limit") {
    const limit = input.price ?? null;
    if (limit == null || !finite(limit)) {
      empty.state = "unavailable";
      empty.lines = [
        {
          label: "Book impact",
          amount: null,
          state: "unavailable",
          detail: "A limit order needs a price before impact can be estimated.",
        },
      ];
      return empty;
    }
    const crosses = input.side === "buy" ? bestAsk != null && limit >= bestAsk : bestBid != null && limit <= bestBid;
    if (!crosses) {
      resting = true;
      filled = input.quantity;
      quote = input.quantity * limit;
      complete = false;
    } else {
      const walked = walk(bookSide, input.quantity, limit, input.side);
      filled = walked.filled;
      quote = walked.quote;
      complete = walked.complete;
    }
  } else {
    const walked = walk(bookSide, input.quantity, null, input.side);
    filled = walked.filled;
    quote = walked.quote;
    complete = walked.complete;
  }

  const average = filled > 0 ? quote / filled : null;
  const slippageBps =
    average != null && mid ? ((input.side === "buy" ? average - mid : mid - average) / mid) * 10_000 : null;
  const notional = marketBuy ? input.quantity : quote;
  const appFee = input.includeAppFee ? requestedAppFee(notional, input.feeTenths, input.side) : 0;
  const budget = input.budgetUsdc;
  const withinBudget = budget == null ? null : Number.isFinite(budget) ? notional <= budget + 1e-9 : null;

  const lines: CostLine[] = [
    {
      label: resting ? "Resting limit" : "Estimated average",
      amount: average == null ? null : average.toFixed(4),
      state: average == null ? "unavailable" : "estimated",
      detail: resting
        ? "The limit does not cross the visible book. A fill is not guaranteed."
        : complete
          ? "Walked against the visible book. The book can move before a signature."
          : "The visible book does not cover the full size.",
    },
    {
      label: "App fee",
      amount: input.side === "buy" ? "0" : input.includeAppFee ? appFee.toFixed(4) : "0",
      state: input.side === "buy" || !input.includeAppFee ? "not-charged" : "estimated",
      detail:
        input.side === "buy"
          ? "Spot buys do not pay the app fee, whether or not the order is tagged."
          : input.includeAppFee
            ? "Requested app fee on a spot sell. This is not a charged fill fee. The fill fee already includes any app fee, so do not add this figure again after a fill."
            : "App fee tag omitted from the order that will be signed.",
    },
    {
      label: "Exchange fee",
      amount: input.exchangeFeeQuote == null ? null : input.exchangeFeeQuote.toFixed(4),
      state: input.exchangeFeeQuote == null ? "unavailable" : "estimated",
      detail:
        input.exchangeFeeQuote == null
          ? "The account fee schedule was not read, so the exchange fee is not estimated."
          : "From the account fee schedule. Not added to the app-fee line.",
    },
  ];

  const stress: StressRow[] = [50, 200].map((bps) => {
    const moved = input.side === "buy" ? mid * (1 + bps / 10_000) : mid * (1 - bps / 10_000);
    const stressed = marketBuy ? input.quantity : input.quantity * moved;
    return {
      label: `${bps / 100}% worse reference`,
      state: "scenario" as const,
      detail: `If the reference moved ${bps} bps against a ${input.side} before execution, the quote value would be about ${stressed.toFixed(2)}. This is arithmetic on the current reference, not a result.`,
    };
  });
  stress.push({
    label: "Funding",
    state: "unavailable",
    detail: "This path prepares a spot order. Perps funding is not part of the signed payload.",
  });

  return {
    state: input.bids.length + input.asks.length === 0 ? "unavailable" : stale ? "stale" : "ready",
    mid,
    spreadBps,
    imbalance,
    averagePrice: average,
    slippageBps,
    filledBase: filled,
    quoteUsed: quote,
    complete,
    resting,
    lines,
    stress,
    withinBudget,
    budgetDetail:
      withinBudget == null
        ? "No risk budget was set."
        : withinBudget
          ? "Size is inside the risk budget you set."
          : "Size is above the risk budget you set. Lower the size before signing.",
  };
}
