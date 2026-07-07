import { NextRequest, NextResponse } from 'next/server';
import { GET as getPrices } from '../prices/route';
import type { Holding, Trade, Portfolio } from '@/types/portfolio';

/**
 * Replay the trade log into cash + holdings instead of trusting the client-sent
 * `usdc`/`holdings` fields directly — those are just numbers a user can edit in
 * devtools/localStorage before generating a "verified" PnL card or leaderboard entry.
 * The trade log itself can still be forged, but this at least makes the reported
 * numbers internally consistent with *some* trade history rather than arbitrary.
 */
function deriveFromTrades(initialBalance: number, trades: Trade[]) {
  const sorted = (trades ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
  let usdc = initialBalance;
  const holdings: Record<string, Holding> = {};

  for (const t of sorted) {
    if (!t || !t.symbol || (t.type !== 'BUY' && t.type !== 'SELL')) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    const price = Math.abs(Number(t.price) || 0);
    const total = amount * price;
    if (amount <= 0 || price <= 0) continue;

    const existing = holdings[t.symbol] ?? { symbol: t.symbol, amount: 0, avgBuyPrice: 0 };

    if (t.type === 'BUY') {
      const newAmount = existing.amount + amount;
      const newCost = existing.amount * existing.avgBuyPrice + total;
      holdings[t.symbol] = { symbol: t.symbol, amount: newAmount, avgBuyPrice: newAmount > 0 ? newCost / newAmount : 0 };
      usdc -= total;
    } else {
      const sellAmount = Math.min(amount, existing.amount);
      holdings[t.symbol] = { symbol: t.symbol, amount: existing.amount - sellAmount, avgBuyPrice: existing.avgBuyPrice };
      usdc += sellAmount * price;
    }
  }

  return { usdc, holdings };
}

export async function POST(req: NextRequest) {
  try {
    const { portfolio } = await req.json() as { portfolio: Portfolio };
    if (!portfolio) return NextResponse.json({ error: 'portfolio required' }, { status: 400 });

    const initialBalance = portfolio.initialBalance ?? 10000;
    const { usdc, holdings } = deriveFromTrades(initialBalance, portfolio.trades ?? []);

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
    const holdingsArr = Object.entries(holdings).filter(([, h]) => h.amount > 0).map(([sym, h]) => {
      const cp = priceMap[sym] ?? h.avgBuyPrice;
      const cv = h.amount * cp;
      const cb = h.amount * h.avgBuyPrice;
      const pnl = cv - cb;
      holdingsValue += cv;
      return { symbol: sym, amount: h.amount, avgBuyPrice: h.avgBuyPrice, currentPrice: cp, currentValue: cv, pnl, pnlPct: cb > 0 ? (pnl/cb)*100 : 0 };
    });

    const totalValue = usdc + holdingsValue;
    const totalPnl = totalValue - initialBalance;
    const totalPnlPct = (totalPnl / initialBalance) * 100;
    const tradeCount = (portfolio.trades ?? []).length;

    // Server-derived score for the public leaderboard — the client's own `soPoints`
    // counter is a forgeable local gamification number, so it's kept for the personal
    // in-app display only and never used for public ranking.
    const rankPoints = Math.max(0, Math.round(tradeCount * 5 + Math.max(0, totalPnlPct) * 10));

    // Build PnL chart
    const chartData: Array<{ date: string; value: number }> = [{ date: 'Start', value: initialBalance }];
    const tradesDesc = (portfolio.trades ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
    let running = initialBalance;
    tradesDesc.forEach((t) => {
      running += t.type === 'SELL' ? t.total : -t.total;
      chartData.push({ date: new Date(t.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'}), value: Math.max(0, running) });
    });
    chartData.push({ date: 'Now', value: totalValue });

    return NextResponse.json({ analytics: { totalValue, holdingsValue, totalPnl, totalPnlPct, holdings: holdingsArr, chartData, tradeCount, soPoints: portfolio.soPoints ?? 0, rankPoints } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
