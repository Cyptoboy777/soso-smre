/**
 * Align cited headlines with observed candle windows.
 * Observations are not causation.
 */

export type EvidenceCandle = { t: number; c: number };
export type EvidenceHeadline = {
  title: string;
  url?: string;
  publishedAt: string;
};

export type EvidenceItem = {
  title: string;
  url?: string;
  publishedAt: string;
  priceBefore: number | null;
  priceAfter: number | null;
  observedMovePct: number | null;
  observation: string;
  alternate: string;
};

export type EvidenceTimeline = {
  state: "ready" | "insufficient" | "stale";
  items: EvidenceItem[];
  detail: string;
};

function nearest(candles: EvidenceCandle[], time: number, direction: "before" | "after"): EvidenceCandle | null {
  const pool = candles.filter((candle) =>
    direction === "before" ? candle.t <= time : candle.t >= time,
  );
  if (!pool.length) return null;
  return pool.reduce((best, candle) =>
    Math.abs(candle.t - time) < Math.abs(best.t - time) ? candle : best,
  );
}

export function buildEvidenceTimeline(input: {
  headlines: EvidenceHeadline[];
  candles: EvidenceCandle[];
  newsFresh: boolean;
  now?: number;
}): EvidenceTimeline {
  const now = input.now ?? Date.now();
  if (!input.newsFresh || input.headlines.length === 0) {
    return {
      state: "insufficient",
      items: [],
      detail: "There is not enough fresh cited news to place next to price. No headline was invented.",
    };
  }

  const candles = input.candles.filter((candle) => Number.isFinite(candle.t) && Number.isFinite(candle.c) && candle.c > 0);
  const newest = candles.reduce((max, candle) => Math.max(max, candle.t), 0);
  const priceStale = candles.length > 0 && now - newest > 6 * 60 * 60 * 1000;

  const items = input.headlines.slice(0, 4).map((headline) => {
    const published = Date.parse(headline.publishedAt);
    const before = Number.isFinite(published) ? nearest(candles, published, "before") : null;
    const after = Number.isFinite(published) ? nearest(candles, published, "after") : null;
    const move =
      before && after && before.c > 0 ? ((after.c - before.c) / before.c) * 100 : null;
    return {
      title: headline.title,
      url: headline.url,
      publishedAt: headline.publishedAt,
      priceBefore: before?.c ?? null,
      priceAfter: after?.c ?? null,
      observedMovePct: move,
      observation:
        move == null
          ? "No candle on both sides of this headline, so no price window is shown."
          : `Observed close moved ${move.toFixed(2)}% between the nearest candles around the headline time.`,
      alternate:
        "The same window can match other flow, a thin book, or a move that started earlier. This does not show the headline caused the price change.",
    };
  });

  return {
    state: priceStale ? "stale" : "ready",
    items,
    detail: priceStale
      ? "The newest candle is more than six hours old. Treat the windows as stale."
      : "Times are the source timestamps. The price window is an observation, not a reason to trade.",
  };
}
