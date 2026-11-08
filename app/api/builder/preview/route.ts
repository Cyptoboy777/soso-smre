import { NextResponse } from "next/server";
import { getBuilderConfig } from "@/lib/sodex-builder";
import { fetchKlinesForNetwork, fetchOrderBookForNetwork } from "@/lib/sodex-market";
import { fetchHotNews } from "@/lib/sosovalue";
import { buildCostLens } from "@/lib/cost-lens";
import { buildEvidenceTimeline } from "@/lib/evidence-timeline";
import { readSpotOrders, restingFrom } from "@/lib/sodex-account-read";
import { selfTradeCheck } from "@/lib/self-trade";
import { isAllowedTradeSymbol } from "@/lib/trade-guard";
import { clientIp, rejectIfRateLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rejectIfRateLimited(
    `builder-preview:${clientIp(req)}`,
    60,
    60_000,
    "Too many requests. Please wait a minute and try again.",
  );
  if (limited) return limited;

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  const engine = symbol === "BTC-USD" || symbol === "ETH-USD" ? "perps" : "spot";
  if (engine === "spot" && !isAllowedTradeSymbol(symbol)) {
    return NextResponse.json({ error: "That market is not available here." }, { status: 400 });
  }
  const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
  const type = url.searchParams.get("type") === "market" ? "market" : "limit";
  const quantity = Number(url.searchParams.get("quantity") ?? "");
  const price = Number(url.searchParams.get("price") ?? "");
  const includeAppFee = url.searchParams.get("includeBuilder") === "1";
  const budget = Number(url.searchParams.get("budget") ?? "");
  const address = (url.searchParams.get("address") ?? "").trim().toLowerCase();
  const cfg = getBuilderConfig();
  const network = "mainnet" as const;
  const live = cfg.executionEnabled;

  const [book, candles, news] = await Promise.all([
    fetchOrderBookForNetwork(symbol, "mainnet", 40, engine),
    engine === "spot" ? fetchKlinesForNetwork(symbol, "mainnet", "1h", 48) : Promise.resolve([]),
    fetchHotNews(),
  ]);

  const lens = buildCostLens({
    side,
    type,
    quantity,
    price: Number.isFinite(price) ? price : null,
    bids: book?.bids ?? [],
    asks: book?.asks ?? [],
    fetchedAt: book?.meta.fetchedAt ?? null,
    includeAppFee,
    feeTenths: includeAppFee ? cfg.builderFee : 0,
    budgetUsdc: Number.isFinite(budget) && budget > 0 ? budget : null,
    exchangeFeeQuote: null,
  });

  const newsFresh = news.meta.source === "live";
  const evidence = buildEvidenceTimeline({
    headlines: newsFresh
      ? news.items.slice(0, 4).map((item) => ({
          title: item.title,
          url: item.url,
          publishedAt: item.publishedAt,
        }))
      : [],
    candles: candles.map((candle) => ({ t: candle.t, c: candle.c })),
    newsFresh,
  });

  let selfTrade: { state: "clear" | "blocked" | "unavailable"; detail: string } = {
    state: "unavailable",
    detail: "Connect a wallet to check your open orders.",
  };
  if (/^0x[0-9a-f]{40}$/.test(address)) {
    const open = await readSpotOrders(network, address);
    selfTrade = selfTradeCheck({
      side,
      type,
      price: Number.isFinite(price) ? price : null,
      resting: open.available ? restingFrom(open.open) : [],
      bookKnown: open.available,
    });
  }

  return NextResponse.json({
    symbol,
    networkLabel: "SoDEX mainnet",
    chainId: 286623,
    executionEnabled: live,
    submission: live ? "enabled" : "disabled",
    tradingLive: live,
    book: book
      ? {
          bids: book.bids.slice(0, 8),
          asks: book.asks.slice(0, 8),
          fetchedAt: book.meta.fetchedAt,
          source: "SoDEX mainnet public order book",
        }
      : null,
    cost: lens,
    evidence,
    selfTrade,
    unavailable: [
      { name: "Unattended bots", reason: "Every order needs your signature. Nothing runs after you leave." },
      { name: "Copy and counter-trade", reason: "No permitted public source of other traders is connected." },
    ],
  });
}
