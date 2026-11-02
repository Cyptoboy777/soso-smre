/**
 * Server-side trade policy: never trust client news-shock / arbitrary symbols
 * for the shared SoDEX testnet key.
 */
import { fetchHotNews } from '@/lib/sosovalue';
import type { NewsPanel, Thesis } from '@/types/flow';

/** Spot symbols FlowSentinel is willing to trade on testnet. */
export const TRADE_SYMBOL_ALLOWLIST = new Set([
  'vBTC_vUSDC',
  'vETH_vUSDC',
  'BTC_USDC',
  'ETH_USDC',
]);

export function isAllowedTradeSymbol(symbol: string): boolean {
  return TRADE_SYMBOL_ALLOWLIST.has(symbol.trim());
}

/**
 * Rebuild news used for the risk gate from the server SoSoValue fetch.
 * Client may still supply thesis geometry; shockActive and items come from us.
 */
export async function serverNewsForRisk(clientNews?: NewsPanel | null): Promise<NewsPanel> {
  const live = await fetchHotNews();
  // Prefer live shock / items; keep client meta only if live is fallback and client claimed nothing worse.
  return {
    ...live,
    // Force shock from server panel — ignore client-forged shockActive=false.
    shockActive: live.shockActive,
    items: live.items.length ? live.items : clientNews?.items ?? [],
  };
}

/** Strip client ability to disable news-shock via thesis.drivers. */
export function hardenThesisForRisk(thesis: Thesis): Thesis {
  return {
    ...thesis,
    drivers: {
      ...thesis.drivers,
      newsShock: Boolean(thesis.drivers?.newsShock),
    },
    // confidence / geometry still evaluated; forged high confidence is mitigated by rate limit + notional cap.
    symbol: String(thesis.symbol || '').trim(),
  };
}
