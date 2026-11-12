/**
 * Depth walk: which visible book levels an order would consume, level by level.
 * Pure and deterministic. Used to draw the pre-signature depth meter.
 * A limit order only walks levels at or better than its limit price.
 */
export type WalkLevel = { price: number; qty: number };
export type WalkRow = {
  price: number;
  available: number;
  taken: number;
  /** 0..1 share of this level the order would take. */
  share: number;
  /** Price distance from the touch in basis points. */
  awayBps: number;
};
export type DepthWalk = {
  rows: WalkRow[];
  filledBase: number;
  quoteUsed: number;
  averagePrice: number | null;
  /** Average-price slippage versus the touch, in bps. Positive is worse. */
  slippageBps: number | null;
  /** True when the visible depth covers the whole order. */
  complete: boolean;
  /** Remaining size that would rest (limit) or that visible depth cannot cover (market). */
  remainder: number;
};

const ok = (n: number) => Number.isFinite(n) && n > 0;

export function walkDepth(input: {
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  /** Base size; quote funds for a market buy. */
  size: number;
  limitPrice?: number | null;
  bids: WalkLevel[];
  asks: WalkLevel[];
}): DepthWalk {
  const book = (input.side === 'buy' ? input.asks : input.bids)
    .filter((l) => ok(l.price) && ok(l.qty))
    .sort((a, b) => (input.side === 'buy' ? a.price - b.price : b.price - a.price));
  const empty: DepthWalk = {
    rows: [],
    filledBase: 0,
    quoteUsed: 0,
    averagePrice: null,
    slippageBps: null,
    complete: false,
    remainder: ok(input.size) ? input.size : 0,
  };
  if (!book.length || !ok(input.size)) return empty;

  const touch = book[0].price;
  const quoteMode = input.type === 'market' && input.side === 'buy';
  const limit = input.type === 'limit' && input.limitPrice && ok(input.limitPrice) ? input.limitPrice : null;
  let left = input.size;
  let filledBase = 0;
  let quoteUsed = 0;
  const rows: WalkRow[] = [];

  for (const level of book) {
    const crosses = limit == null || (input.side === 'buy' ? level.price <= limit : level.price >= limit);
    const awayBps = (Math.abs(level.price - touch) / touch) * 10_000;
    let taken = 0;
    if (crosses && left > 1e-12) {
      if (quoteMode) {
        const levelQuote = level.price * level.qty;
        const spend = Math.min(left, levelQuote);
        taken = spend / level.price;
        left -= spend;
      } else {
        taken = Math.min(left, level.qty);
        left -= taken;
      }
      filledBase += taken;
      quoteUsed += taken * level.price;
    }
    rows.push({ price: level.price, available: level.qty, taken, share: taken / level.qty, awayBps });
  }

  const averagePrice = filledBase > 0 ? quoteUsed / filledBase : null;
  const slippageBps =
    averagePrice == null
      ? null
      : ((input.side === 'buy' ? averagePrice - touch : touch - averagePrice) / touch) * 10_000;
  const remainder = left > 1e-12 ? left : 0;
  return { rows, filledBase, quoteUsed, averagePrice, slippageBps, complete: remainder === 0, remainder };
}
