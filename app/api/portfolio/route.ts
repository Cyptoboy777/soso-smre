import { NextRequest, NextResponse } from 'next/server';
import { GET as getPrices } from '../prices/route';

interface Holding { symbol: string; amount: number; avgBuyPrice: number; }
interface Trade { id: string; symbol: string; type: 'BUY'|'SELL'; amount: number; price: number; total: number; timestamp: number; }
interface Portfolio { usdc: number; holdings: Record<string,Holding>; trades: Trade[]; initialBalance: number; soPoints: number; }

export async function POST(req: NextRequest) {
  try {
    const { portfolio } = await req.json() as { portfolio: Portfolio };
    if (!portfolio) return NextResponse.json({ error: 'portfolio required' }, { status: 400 });

    const symbols = Object.keys(portfolio.holdings ?? {});
    const priceMap: Record<string, number> = {};

    try {
      const res = await getPrices();
      const data = await res.json() as { prices?: Array<{ symbol: string; price: string }> };
      if (data.prices) {
        data.prices.forEach(d => { priceMap[d.symbol.replace('USDT', '')] = parseFloat(d.price); });
      }
    } catch (e) {
      console.warn("Portfolio live price fetch failed", e);
    }

    let holdingsValue = 0;
    const holdingsArr = Object.entries(portfolio.holdings ?? {}).map(([sym, h]) => {
      const cp = priceMap[sym] ?? h.avgBuyPrice;
      const cv = h.amount * cp;
      const cb = h.amount * h.avgBuyPrice;
      const pnl = cv - cb;
      holdingsValue += cv;
      return { symbol: sym, amount: h.amount, avgBuyPrice: h.avgBuyPrice, currentPrice: cp, currentValue: cv, pnl, pnlPct: cb > 0 ? (pnl/cb)*100 : 0 };
    });

    const totalValue = (portfolio.usdc ?? 10000) + holdingsValue;
    const totalPnl = totalValue - (portfolio.initialBalance ?? 10000);
    const totalPnlPct = ((totalPnl / (portfolio.initialBalance ?? 10000)) * 100);

    // Build PnL chart
    const chartData: Array<{ date: string; value: number }> = [{ date: 'Start', value: portfolio.initialBalance ?? 10000 }];
    const trades = (portfolio.trades ?? []).slice().reverse();
    let running = portfolio.initialBalance ?? 10000;
    trades.forEach((t) => {
      running += t.type === 'SELL' ? t.total : -t.total;
      chartData.push({ date: new Date(t.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'}), value: Math.max(0, running) });
    });
    chartData.push({ date: 'Now', value: totalValue });

    return NextResponse.json({ analytics: { totalValue, holdingsValue, totalPnl, totalPnlPct, holdings: holdingsArr, chartData, tradeCount: (portfolio.trades??[]).length, soPoints: portfolio.soPoints ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
