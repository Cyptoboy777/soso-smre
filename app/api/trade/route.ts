import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { symbol, type, amount, price, availableUsdc, currentHolding } = await req.json() as {
      symbol: string; type: 'BUY'|'SELL'; amount: number; price: number; availableUsdc?: number; currentHolding?: number;
    };

    if (!symbol || !type || !amount || !price) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (amount <= 0 || price <= 0) return NextResponse.json({ error: 'Amount and price must be positive' }, { status: 400 });

    const total = amount * price;

    if (type === 'BUY' && availableUsdc !== undefined && total > availableUsdc) {
      return NextResponse.json({ error: `Insufficient USDC. Need $${total.toFixed(2)}, have $${availableUsdc.toFixed(2)}` }, { status: 400 });
    }
    if (type === 'SELL' && currentHolding !== undefined && amount > currentHolding) {
      return NextResponse.json({ error: `Insufficient ${symbol}. Need ${amount}, have ${currentHolding}` }, { status: 400 });
    }

    const trade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      symbol, type, amount, price, total,
      timestamp: Date.now(),
    };

    return NextResponse.json({ success: true, trade, soPointsEarned: Math.floor(total / 100) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
