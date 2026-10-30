/**
 * SoSoValue OpenAPI client.
 * Base: https://openapi.sosovalue.com/openapi/v1
 * Auth header: x-soso-api-key
 * Docs: https://sosovalue-1.gitbook.io/sosovalue-api-doc
 * Rate limit ~20 calls/min — Next.js fetch revalidate=300s caches responses.
 */
import type {
  EtfFlowDay,
  EtfPanel,
  NewsItem,
  NewsPanel,
  SsiPanel,
  SourceMeta,
} from '@/types/flow';

const BASE = 'https://openapi.sosovalue.com/openapi/v1';

export function hasSosoKey(): boolean {
  return Boolean(process.env.SOSOVALUE_API_KEY?.trim());
}

function meta(source: SourceMeta['source'], endpoint?: string, note?: string): SourceMeta {
  return { source, endpoint, fetchedAt: new Date().toISOString(), note };
}

async function sosoGet<T>(path: string, params?: Record<string, string>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = process.env.SOSOVALUE_API_KEY?.trim();
  if (!key) return { ok: false, error: 'SOSOVALUE_API_KEY missing' };

  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'x-soso-api-key': key,
        Accept: 'application/json',
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { code?: number; data?: T; message?: string; error?: string };
    // Some endpoints wrap in {code,data}; others return data directly.
    if (typeof body === 'object' && body !== null && 'code' in body) {
      if (body.code !== 0 && body.code !== undefined) {
        return { ok: false, error: body.message || body.error || `code ${body.code}` };
      }
      return { ok: true, data: (body.data ?? body) as T };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function mapEtfRows(rows: Array<Record<string, unknown>>): EtfFlowDay[] {
  return rows.map((r) => ({
    date: String(r.date ?? ''),
    totalNetInflow: Number(r.total_net_inflow ?? 0),
    totalValueTraded: Number(r.total_value_traded ?? 0),
    totalNetAssets: Number(r.total_net_assets ?? 0),
    cumNetInflow: Number(r.cum_net_inflow ?? 0),
  }));
}

/** Deterministic illustrative fallback — NEVER presented as live. */
function fallbackEtf(symbol: 'BTC' | 'ETH'): EtfPanel {
  // Deterministic, realistic-looking sample for demos — always labelled Fallback.
  const series =
    symbol === 'BTC'
      ? [182.4, -94.2, 241.8, 67.5, -31.1, 312.0, 148.6]
      : [41.2, -28.7, 55.4, 12.8, -19.3, 63.1, 22.5];
  const history: EtfFlowDay[] = series.map((m, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (series.length - i));
    // skip weekends for realism
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
    const inflow = m * 1_000_000;
    return {
      date: d.toISOString().slice(0, 10),
      totalNetInflow: inflow,
      totalValueTraded: (symbol === 'BTC' ? 4.2 : 1.1) * 1e9 + Math.abs(m) * 8e6,
      totalNetAssets: symbol === 'BTC' ? 98.4e9 : 12.6e9,
      cumNetInflow: (symbol === 'BTC' ? 42.1e9 : 6.8e9) + inflow,
    };
  }).reverse();
  return {
    symbol,
    country: 'US',
    latest: history[0] ?? null,
    history,
    meta: meta('fallback', '/etfs/summary-history', 'Labelled sample — set SOSOVALUE_API_KEY for live ETF flows'),
  };
}

export async function fetchEtfFlows(symbol: 'BTC' | 'ETH'): Promise<EtfPanel> {
  const path = '/etfs/summary-history';
  const result = await sosoGet<Array<Record<string, unknown>> | { list?: Array<Record<string, unknown>> }>(
    path,
    { symbol, country_code: 'US', limit: '14' },
  );

  if (!result.ok) {
    const fb = fallbackEtf(symbol);
    fb.meta.note = `Live fetch failed (${result.error}). Showing labelled fallback.`;
    return fb;
  }

  const raw = Array.isArray(result.data)
    ? result.data
    : Array.isArray((result.data as { list?: Array<Record<string, unknown>> }).list)
      ? (result.data as { list: Array<Record<string, unknown>> }).list
      : [];

  if (!raw.length) {
    const fb = fallbackEtf(symbol);
    fb.meta.note = 'Live response empty — labelled fallback.';
    return fb;
  }

  const history = mapEtfRows(raw);
  return {
    symbol,
    country: 'US',
    latest: history[0] ?? null,
    history,
    meta: meta('live', path),
  };
}

const SHOCK_RE =
  /\b(hack|exploit|sec\b|lawsuit|ban|crash|halt|insolvent|bankrupt|emergency|collapse|fraud|charged|indicted)\b/i;

function fallbackNews(): NewsPanel {
  return {
    items: [
      {
        id: 'fb-1',
        title: '[Fallback] Spot BTC ETF flows in focus ahead of weekly close',
        url: 'https://sosovalue.com',
        summary: 'Labelled sample: Spot BTC ETF books mixed prints into week-end (not live).',
        publishedAt: new Date().toISOString(),
        isShock: false,
      },
      {
        id: 'fb-2',
        title: '[Fallback] ETH staking yields steady as L2 activity cools',
        url: 'https://sosovalue.com',
        summary: 'Labelled sample: ETH staking yields steady as L2 fees cool (not live).',
        publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
        isShock: false,
      },
    ],
    shockActive: false,
    meta: meta('fallback', '/news/hot', 'Labelled sample — set SOSOVALUE_API_KEY for live hot news'),
  };
}

export async function fetchHotNews(): Promise<NewsPanel> {
  const path = '/news/hot';
  const result = await sosoGet<{
    list?: Array<{
      id?: number | string;
      title?: string;
      source_link?: string;
      content?: string;
      release_time?: number | string;
    }>;
  }>(path, { page: '1', page_size: '12' });

  if (!result.ok) {
    const fb = fallbackNews();
    fb.meta.note = `Live fetch failed (${result.error}). Showing labelled fallback.`;
    return fb;
  }

  const list = result.data.list ?? [];
  if (!list.length) {
    const fb = fallbackNews();
    fb.meta.note = 'Live response empty — labelled fallback.';
    return fb;
  }

  const items: NewsItem[] = list.map((n, i) => {
    const title = n.title ?? 'Untitled';
    const ts = typeof n.release_time === 'string' ? parseInt(n.release_time, 10) : Number(n.release_time ?? Date.now());
    const plain = (n.content ?? '').replace(/<[^>]+>/g, '').slice(0, 220);
    return {
      id: String(n.id ?? i),
      title,
      url: n.source_link ?? 'https://sosovalue.com',
      summary: plain || title,
      publishedAt: new Date(ts || Date.now()).toISOString(),
      isShock: SHOCK_RE.test(title) || SHOCK_RE.test(plain),
    };
  });

  return {
    items,
    shockActive: items.some((x) => x.isShock),
    meta: meta('live', path),
  };
}

function fallbackSsi(): SsiPanel {
  return {
    ticker: 'ssiMAG7',
    price: 21.4,
    changePct24h: 0.0042,
    roi7d: 0.018,
    meta: meta('fallback', '/indices/ssimag7/market-snapshot', 'Labelled sample — set SOSOVALUE_API_KEY for live SSI'),
  };
}

export async function fetchSsiSnapshot(ticker = 'ssimag7'): Promise<SsiPanel> {
  const path = `/indices/${ticker}/market-snapshot`;
  const result = await sosoGet<{
    price?: number;
    change_pct_24h?: number;
    roi_7d?: number;
  }>(path);

  if (!result.ok) {
    const fb = fallbackSsi();
    fb.meta.note = `Live fetch failed (${result.error}). Showing labelled fallback.`;
    return fb;
  }

  return {
    ticker,
    price: result.data.price ?? null,
    changePct24h: result.data.change_pct_24h ?? null,
    roi7d: result.data.roi_7d ?? null,
    meta: meta('live', path),
  };
}
