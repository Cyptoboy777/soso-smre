export type OrderIntent = "spot" | "grid" | "perps" | "stop" | "bracket" | "twap" | "dca";

export type IntentView = {
  title: string;
  engine: "spot" | "perps";
  showLimitPrice: boolean;
  showStop: boolean;
  showTarget: boolean;
  showMinutes: boolean;
  showHour: boolean;
  showGrid: boolean;
  costNote: string;
};

export function intentView(intent: OrderIntent, orderType: "limit" | "market" = "limit"): IntentView {
  const perps = intent !== "spot" && intent !== "grid";
  const base = {
    engine: perps ? "perps" : "spot",
    showLimitPrice: false,
    showStop: false,
    showTarget: false,
    showMinutes: false,
    showHour: false,
    showGrid: false,
  } as const;
  switch (intent) {
    case "grid":
      return {
        ...base,
        engine: "spot",
        title: "Spot grid",
        showGrid: true,
        costNote: "Each line is a resting limit. Buy prices stay below sell prices. Nothing requotes after you review the list.",
      };
    case "perps":
      return {
        ...base,
        title: "Perps order",
        showLimitPrice: orderType === "limit",
        costNote: "Perps. An open position can pay or receive funding. This review does not invent a funding payment.",
      };
    case "stop":
      return {
        ...base,
        title: "Perps reduce-only stop",
        showStop: true,
        costNote: "This stop only reduces a position. It uses the mark price as the trigger. It is not a spot order.",
      };
    case "bracket":
      return {
        ...base,
        title: "Perps entry with target and stop",
        showLimitPrice: orderType === "limit",
        showStop: true,
        showTarget: true,
        costNote: "The entry is sent with a reduce-only target and stop. Funding can apply while a position is open.",
      };
    case "twap":
      return {
        ...base,
        title: "Perps TWAP",
        showMinutes: true,
        costNote: "Size is split over the minutes you set. Each child is a market order with the exchange price bound. This is not one limit.",
      };
    case "dca":
      return {
        ...base,
        title: "Perps daily amount",
        showHour: true,
        costNote: "Each day uses the USDC amount at the hour you set. Later runs are not reserved now, and this review does not start them.",
      };
    default:
      return {
        ...base,
        engine: "spot",
        title: "Spot order",
        showLimitPrice: orderType === "limit",
        costNote: "Spot. A buy does not pay the optional app fee. Funding does not apply.",
      };
  }
}
