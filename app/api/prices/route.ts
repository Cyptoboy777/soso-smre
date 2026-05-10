import { NextResponse } from 'next/server';

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','MATICUSDT'];

export async function GET() {
  try {
    const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(SYMBOLS)}`;
    const [binanceRes, cgPriceRes, cgGlobalRes] = await Promise.all([
      fetch(binanceUrl, { next: { revalidate: 10 } }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=sosovalue&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true', { next: { revalidate: 30 } }),
      fetch('https://api.coingecko.com/api/v3/global', { next: { revalidate: 60 } })
    ]);

    let data: BinanceTicker[] = [];
    if (binanceRes.ok) {
      data = await binanceRes.json() as BinanceTicker[];
    }

    let sosoPrice = '0.40';
    let sosoChange = '0.00';
    let sosoVol = '0';
    if (cgPriceRes.ok) {
      const cgData = await cgPriceRes.json();
      if (cgData?.sosovalue) {
        sosoPrice = cgData.sosovalue.usd.toString();
        sosoChange = (cgData.sosovalue.usd_24h_change || 0).toString();
        sosoVol = (cgData.sosovalue.usd_24h_vol || 0).toString();
      }
    }

    let globalMarketCap = '2.45T';
    if (cgGlobalRes.ok) {
      const cgGlobal = await cgGlobalRes.json();
      if (cgGlobal?.data?.total_market_cap?.usd) {
        const mcap = cgGlobal.data.total_market_cap.usd;
        globalMarketCap = (mcap / 1e12).toFixed(2) + 'T';
      }
    }

    const map: Record<string, BinanceTicker> = {};
    data.forEach(t => { map[t.symbol] = t; });

    // Inject SOSO token price from CoinGecko
    map['SOSOUSDT'] = {
      symbol: 'SOSOUSDT',
      lastPrice: sosoPrice,
      priceChangePercent: sosoChange,
      volume: sosoVol,
      quoteVolume: sosoVol,
      highPrice: sosoPrice,
      lowPrice: sosoPrice,
    };

    const ALL_SYMBOLS = [...SYMBOLS, 'SOSOUSDT'];

    const prices = ALL_SYMBOLS.map(sym => ({
      symbol: sym,
      price: parseFloat(map[sym]?.lastPrice ?? '0').toFixed(sym === 'BTCUSDT' ? 2 : sym === 'ETHUSDT' ? 2 : 4),
      change: parseFloat(map[sym]?.priceChangePercent ?? '0').toFixed(2),
      volume: parseFloat(map[sym]?.quoteVolume ?? '0').toFixed(0),
      high: parseFloat(map[sym]?.highPrice ?? '0').toFixed(2),
      low: parseFloat(map[sym]?.lowPrice ?? '0').toFixed(2),
    }));

    return NextResponse.json({
      btc: parseFloat(map['BTCUSDT']?.lastPrice ?? '0'),
      eth: parseFloat(map['ETHUSDT']?.lastPrice ?? '0'),
      sol: parseFloat(map['SOLUSDT']?.lastPrice ?? '0'),
      bnb: parseFloat(map['BNBUSDT']?.lastPrice ?? '0'),
      soso: parseFloat(map['SOSOUSDT']?.lastPrice ?? '0'),
      globalMarketCap,
      prices,
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Live price provider failed', prices: [] },
      { status: 502 },
    );
  }
}
