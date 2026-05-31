/**
 * lib/newsFilter.ts
 * Shared news filtering logic — eliminates duplication between SoSoValue and Reddit feeds
 */

export interface RawNewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  time: string;
  pubTime: number;
  age: number;
  isMajor: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  time: string;
}

const MAJOR_KEYWORDS = /SEC|ETF|Fed|Hack|Crash|Binance|BlackRock|Rate|Inflation|Regulation|Lawsuit|Exploit|Whale/i;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function isMajorNews(title: string): boolean {
  return MAJOR_KEYWORDS.test(title);
}

/**
 * Filters and sorts a list of raw news items:
 * - Major news stays up to 24 hours
 * - Normal news rotates every 4 hours
 * - Falls back to latest N items if filters are too strict
 */
export function filterAndSortNews(
  items: RawNewsItem[],
  limit = 15,
): RawNewsItem[] {
  const major = items.filter((n) => n.isMajor && n.age <= TWENTY_FOUR_HOURS);
  const normal = items.filter((n) => !n.isMajor && n.age <= FOUR_HOURS);

  major.sort((a, b) => b.pubTime - a.pubTime);
  normal.sort((a, b) => b.pubTime - a.pubTime);

  const combined = [...major, ...normal];
  return (combined.length > 0 ? combined : items).slice(0, limit);
}

/** Strip internal fields before sending to client */
export function stripInternalFields(items: RawNewsItem[]): NewsItem[] {
  return items.map(({ pubTime: _p, age: _a, isMajor: _m, ...rest }) => rest);
}
