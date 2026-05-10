/**
 * SoDEX API Utility
 * Based on official documentation: https://mainnet-gw.sodex.dev/api/v1
 */

export const SODEX_ENDPOINTS = {
  MAINNET: {
    SPOT: 'https://mainnet-gw.sodex.dev/api/v1/spot',
    PERPS: 'https://mainnet-gw.sodex.dev/api/v1/perps',
  },
  TESTNET: {
    SPOT: 'https://testnet-gw.sodex.dev/api/v1/spot',
    PERPS: 'https://testnet-gw.sodex.dev/api/v1/perps',
  }
};

export interface SodexTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

export async function getSodexTickers(isPerps = false): Promise<SodexTicker[]> {
  try {
    const base = SODEX_ENDPOINTS.MAINNET[isPerps ? 'PERPS' : 'SPOT'];
    const res = await fetch(`${base}/markets/tickers`, { 
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 30 } 
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.warn("SoDEX Ticker Fetch Timeout/Error:", e);
    return [];
  }
}

export async function getSodexSymbols(isPerps = false) {
  try {
    const base = SODEX_ENDPOINTS.MAINNET[isPerps ? 'PERPS' : 'SPOT'];
    const res = await fetch(`${base}/markets/symbols`, { 
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 } 
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}
