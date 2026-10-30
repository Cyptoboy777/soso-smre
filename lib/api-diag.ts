/** Live probe of SoSoValue + SoDEX endpoints used by the desk. */
export type DiagRow = {
  name: string;
  provider: 'sosovalue' | 'sodex';
  method: 'GET' | 'POST';
  url: string;
  status: number | 'error';
  ok: boolean;
  ms: number;
  note?: string;
};

async function probe(name: string, provider: DiagRow['provider'], url: string, init?: RequestInit): Promise<DiagRow> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
    });
    return {
      name,
      provider,
      method: (init?.method as 'GET' | 'POST') || 'GET',
      url,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      name,
      provider,
      method: (init?.method as 'GET' | 'POST') || 'GET',
      url,
      status: 'error',
      ok: false,
      ms: Date.now() - t0,
      note: e instanceof Error ? e.message.slice(0, 120) : String(e),
    };
  }
}

export async function runApiDiagnostics(): Promise<{ rows: DiagRow[]; asOf: string }> {
  const sosoKey = process.env.SOSOVALUE_API_KEY?.trim();
  const sosoBase = 'https://openapi.sosovalue.com/openapi/v1';
  const testnet = 'https://testnet-gw.sodex.dev';
  const mainnet = 'https://mainnet-gw.sodex.dev';

  const sosoHeaders = sosoKey ? { 'x-soso-api-key': sosoKey } : undefined;
  const rows = await Promise.all([
    probe('ETF BTC summary-history', 'sosovalue', `${sosoBase}/etfs/summary-history?symbol=BTC&country_code=US&limit=3`, {
      headers: sosoHeaders,
    }),
    probe('ETF ETH summary-history', 'sosovalue', `${sosoBase}/etfs/summary-history?symbol=ETH&country_code=US&limit=3`, {
      headers: sosoHeaders,
    }),
    probe('Hot news', 'sosovalue', `${sosoBase}/news/hot?page=1&page_size=5`, { headers: sosoHeaders }),
    probe('ssiMAG7 snapshot', 'sosovalue', `${sosoBase}/indices/ssimag7/market-snapshot`, { headers: sosoHeaders }),
    probe('SoDEX testnet tickers', 'sodex', `${testnet}/api/v1/spot/markets/tickers?symbol=vBTC_vUSDC`),
    probe('SoDEX testnet orderbook', 'sodex', `${testnet}/api/v1/spot/markets/vBTC_vUSDC/orderbook?limit=5`),
    probe('SoDEX testnet klines', 'sodex', `${testnet}/api/v1/spot/markets/vBTC_vUSDC/klines?interval=1h&limit=3`),
    probe('SoDEX testnet trades', 'sodex', `${testnet}/api/v1/spot/markets/vBTC_vUSDC/trades?limit=3`),
    probe('SoDEX mainnet tickers (public read)', 'sodex', `${mainnet}/api/v1/spot/markets/tickers?symbol=vBTC_vUSDC`),
    probe('SoDEX perps funding hint', 'sodex', `${testnet}/api/v1/perps/markets/tickers?symbol=BTC-USD`),
  ]);

  if (!sosoKey) {
    for (const r of rows) {
      if (r.provider === 'sosovalue' && !r.ok) {
        r.note = (r.note ? r.note + ' · ' : '') + 'SOSOVALUE_API_KEY missing in this runtime';
      }
    }
  }

  return { rows, asOf: new Date().toISOString() };
}
