/**
 * SoSoValue OpenAPI client.
 * Base: https://openapi.sosovalue.com/openapi/v1
 * Auth header: x-soso-api-key
 * Docs: https://sosovalue-1.gitbook.io/sosovalue-api-doc
 * Rate limit ~20 calls/min - Next.js fetch revalidate=300s caches responses.
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

/**
 * Honest empty panel. No sample numbers are ever substituted for live data;
 * the UI shows an empty state instead. Notes are user-facing and never name
 * environment variables or echo upstream errors.
 */
const NOTE_OFFLINE = 'SoSoValue data is not available right now.';
const NOTE_EMPTY = 'SoSoValue returned no rows for this view.';

function emptyEtf(symbol: 'BTC' | 'ETH', note: string): EtfPanel {
  return {
    symbol,
    country: 'US',
    latest: null,
    history: [],
    meta: meta('unavailable', '/etfs/summary-history', note),
  };
}

export async function fetchEtfFlows(symbol: 'BTC' | 'ETH'): Promise<EtfPanel> {
  const path = '/etfs/summary-history';
  const result = await sosoGet<Array<Record<string, unknown>> | { list?: Array<Record<string, unknown>> }>(
    path,
    { symbol, country_code: 'US', limit: '14' },
  );

  if (!result.ok) {
    return emptyEtf(symbol, NOTE_OFFLINE);
  }

  const raw = Array.isArray(result.data)
    ? result.data
    : Array.isArray((result.data as { list?: Array<Record<string, unknown>> }).list)
      ? (result.data as { list: Array<Record<string, unknown>> }).list
      : [];

  if (!raw.length) {
    return emptyEtf(symbol, NOTE_EMPTY);
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

function emptyNews(note: string): NewsPanel {
  return { items: [], shockActive: false, meta: meta('unavailable', '/news/hot', note) };
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
    return emptyNews(NOTE_OFFLINE);
  }

  const list = result.data.list ?? [];
  if (!list.length) {
    return emptyNews(NOTE_EMPTY);
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

function emptySsi(ticker: string, note: string): SsiPanel {
  return {
    ticker,
    price: null,
    changePct24h: null,
    roi7d: null,
    meta: meta('unavailable', `/indices/${ticker}/market-snapshot`, note),
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
    return emptySsi(ticker, NOTE_OFFLINE);
  }

  return {
    ticker,
    price: result.data.price ?? null,
    changePct24h: result.data.change_pct_24h ?? null,
    roi7d: result.data.roi_7d ?? null,
    meta: meta('live', path),
  };
}

export type SectorMove = { name: string; changePct24h: number | null; dominance: number | null };
export type SectorSpotlightPanel = {
  sectors: SectorMove[];
  spotlight: SectorMove[];
  meta: SourceMeta;
};

function toNum(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Map the official `GET /currencies/sector-spotlight` response. Pure; exported for tests. */
export function mapSectorSpotlight(data: unknown): { sectors: SectorMove[]; spotlight: SectorMove[] } {
  const body = (data ?? {}) as { sector?: unknown; spotlight?: unknown };
  const rows = (list: unknown): SectorMove[] =>
    Array.isArray(list)
      ? list
          .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && typeof (r as { name?: unknown }).name === 'string')
          .map((r) => ({
            name: String(r.name).trim(),
            // Docs show `24h_change_pct`; the live API returns `change_pct_24h`. Both are fractions.
            changePct24h: toNum(r.change_pct_24h ?? r['24h_change_pct']),
            dominance: toNum(r.marketcap_dom),
          }))
      : [];
  return { sectors: rows(body.sector), spotlight: rows(body.spotlight) };
}

/**
 * SoSoValue sector & spotlight moves.
 * Docs: https://docs.sodex.com/for-developers/api-reference/market-data-api/currency/sector-spotlight
 */
export async function fetchSectorSpotlight(): Promise<SectorSpotlightPanel> {
  const path = '/currencies/sector-spotlight';
  const result = await sosoGet<unknown>(path);
  if (!result.ok) {
    return { sectors: [], spotlight: [], meta: meta('unavailable', path, NOTE_OFFLINE) };
  }
  const mapped = mapSectorSpotlight(result.data);
  if (!mapped.sectors.length && !mapped.spotlight.length) {
    return { ...mapped, meta: meta('unavailable', path, NOTE_EMPTY) };
  }
  return { ...mapped, meta: meta('live', path) };
}
