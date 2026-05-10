import { NextResponse } from 'next/server';

interface Metric {
  value?: number | string | null;
  lastUpdateDate?: string;
}

interface EtfRow {
  ticker?: string;
  institute?: string;
  netAssets?: Metric;
  dailyNetInflow?: Metric;
  dailyValueTraded?: Metric;
}

const numberValue = (metric?: Metric) => {
  const value = metric?.value;
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET() {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) return NextResponse.json({ error: 'SOSOVALUE_API_KEY missing' }, { status: 500 });

  try {
    const response = await fetch('https://openapi.sosovalue.com/openapi/v1/etf/us-btc-spot/currentEtfDataMetrics', {
      method: 'POST',
      headers: {
        'x-soso-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      next: { revalidate: 300 },
    });

    if (!response.ok) throw new Error(`SoSoValue ETF API ${response.status}`);
    const payload = await response.json() as {
      code: number;
      msg?: string | null;
      data?: {
        dailyNetInflow?: Metric;
        totalNetAssets?: Metric;
        dailyTotalValueTraded?: Metric;
        list?: EtfRow[];
      };
    };

    if (payload.code !== 0 || !payload.data) throw new Error(payload.msg ?? 'SoSoValue ETF API failed');

    const funds = (payload.data.list ?? []).map(item => {
      const inflow = numberValue(item.dailyNetInflow);
      return {
        ticker: item.ticker ?? '--',
        name: item.institute ?? item.ticker ?? 'ETF',
        aum: numberValue(item.netAssets),
        inflow,
        valueTraded: numberValue(item.dailyValueTraded),
        pos: (inflow ?? 0) >= 0,
      };
    });

    const totalInflow = numberValue(payload.data.dailyNetInflow);
    const totalAssets = numberValue(payload.data.totalNetAssets);
    const valueTraded = numberValue(payload.data.dailyTotalValueTraded);

    return NextResponse.json({
      totalInflow,
      totalOutflow: funds.reduce((sum, fund) => sum + Math.min(fund.inflow ?? 0, 0), 0),
      totalAssets,
      valueTraded,
      funds,
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ETF provider failed' }, { status: 502 });
  }
}
