/**
 * News Monitor — adapted from day-trader-skill trader-news (MIT).
 * Uses SoSoValue news (not Yahoo/SEC). Tags headlines per watched asset.
 */
import type { NewsItem } from "@/types/flow";

const KEYWORDS: Array<[string, RegExp]> = [
  ["earnings", /\bearnings\b|\bresults\b|\bEPS\b|\bguidance\b|\bforecast\b/i],
  ["analyst", /\bupgrade[sd]?\b|\bdowngrade[sd]?\b|price target|\boutperform\b|\bunderperform\b/i],
  ["legal", /\blawsuit\b|\bsued\b|\bprobe\b|\binvestigation\b|\bSEC\b|\bcourt\b/i],
  ["deal", /\bacqui(?:re|res|red|sition)\b|\bmerger\b|\bbuyout\b|\btakeover\b|\bdeal\b/i],
  ["capital", /\bdividend\b|\bbuyback\b|\brepurchase\b|\bstock split\b|\boffering\b/i],
  ["people", /\bCEO\b|\bCFO\b|\bresign|\bsteps down\b|\bappoint/i],
  ["risk", /\brecall\b|\bbankrupt|\bdefault\b|\bdelist|\bhack|\bbreach\b|\boutage\b/i],
  ["halt", /\bhalt(?:s|ed)?\b|\btrading (?:pause|suspen)/i],
  ["macro", /\bFed\b|\bFOMC\b|\bCPI\b|\binflation\b|\btariffs?\b|\bfutures\b|\bETF\b/i],
  ["crypto", /\bbitcoin\b|\bBTC\b|\bethereum\b|\bETH\b|\bspot ETF\b|\bon-chain\b|\bSoDEX\b/i],
];

const ASSET_PATTERNS: Record<string, RegExp> = {
  vBTC_vUSDC: /\bBTC\b|\bbitcoin\b|\bXBTC\b/i,
  vETH_vUSDC: /\bETH\b|\bethereum\b|\bether\b/i,
  BTC_USDC: /\bBTC\b|\bbitcoin\b/i,
  ETH_USDC: /\bETH\b|\bethereum\b/i,
};

export type TaggedNews = {
  item: NewsItem;
  assets: string[];
  tags: string[];
  relevant: boolean;
};

export function tagNewsForAssets(
  items: NewsItem[],
  watchSymbols: string[],
): TaggedNews[] {
  return items.map((item) => {
    const text = `${item.title} ${item.summary}`;
    const tags = KEYWORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
    const assets = watchSymbols.filter((sym) => {
      const re = ASSET_PATTERNS[sym] ?? new RegExp(sym.replace(/[^A-Za-z]/g, ""), "i");
      return re.test(text);
    });
    return {
      item,
      assets,
      tags,
      relevant: assets.length > 0 || item.isShock || tags.includes("macro"),
    };
  });
}

export function newsForSymbol(
  tagged: TaggedNews[],
  symbol: string,
): TaggedNews[] {
  return tagged.filter(
    (t) => t.assets.includes(symbol) || t.item.isShock || t.tags.includes("macro"),
  );
}
