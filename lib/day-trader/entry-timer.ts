/**
 * Entry Timer — adapted from day-trader-skill trader-entry (MIT).
 * Watches ORB / level setups on completed bars. Never places an order.
 */
import { detectOrb, type Bar } from "@/lib/day-trader/scanner";

export type EntryStatus =
  | "triggered"
  | "waiting"
  | "expired"
  | "no-data";

export type EntryCheck = {
  status: EntryStatus;
  setup: "orb" | "level";
  side: "buy" | "sell" | null;
  entryPrice: number | null;
  entryBarIndex: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  detail: string;
};

export function checkEntry(opts: {
  bars: Bar[];
  setup?: "orb" | "level";
  orBars?: number;
  level?: number;
  preferSide?: "long" | "short" | "both";
}): EntryCheck {
  if (!opts.bars.length) {
    return {
      status: "no-data",
      setup: opts.setup ?? "orb",
      side: null,
      entryPrice: null,
      entryBarIndex: null,
      rangeHigh: null,
      rangeLow: null,
      detail: "No completed SoDEX bars yet.",
    };
  }
  const setup = opts.setup ?? "orb";
  if (setup === "level") {
    const level = opts.level;
    if (level == null) {
      return {
        status: "waiting",
        setup,
        side: null,
        entryPrice: null,
        entryBarIndex: null,
        rangeHigh: null,
        rangeLow: null,
        detail: "Level setup needs --level.",
      };
    }
    for (let i = 0; i < opts.bars.length; i++) {
      const b = opts.bars[i]!;
      if (b.c > level) {
        return {
          status: "triggered",
          setup,
          side: "buy",
          entryPrice: b.c,
          entryBarIndex: i,
          rangeHigh: null,
          rangeLow: null,
          detail: `First close above ${level} at bar ${i}.`,
        };
      }
    }
    return {
      status: "waiting",
      setup,
      side: null,
      entryPrice: null,
      entryBarIndex: null,
      rangeHigh: null,
      rangeLow: null,
      detail: `No completed close above ${level} yet.`,
    };
  }

  const orb = detectOrb({
    bars: opts.bars,
    orBars: opts.orBars ?? 12, // 60m default for crypto UTC day; stock skill uses 15m
    side: opts.preferSide ?? "both",
  });
  if (orb.triggered) {
    return {
      status: "triggered",
      setup: "orb",
      side: orb.side === "short" ? "sell" : "buy",
      entryPrice: orb.entryPrice,
      entryBarIndex: orb.entryBarIndex,
      rangeHigh: orb.rangeHigh,
      rangeLow: orb.rangeLow,
      detail: `ORB ${orb.side}: first close beyond range [${orb.rangeLow.toFixed(2)}, ${orb.rangeHigh.toFixed(2)}].`,
    };
  }
  return {
    status: "waiting",
    setup: "orb",
    side: null,
    entryPrice: null,
    entryBarIndex: null,
    rangeHigh: orb.rangeHigh,
    rangeLow: orb.rangeLow,
    detail: `Waiting for close beyond opening range [${orb.rangeLow.toFixed(2)}, ${orb.rangeHigh.toFixed(2)}].`,
  };
}
