// Server-only helpers shared by the AI routes (rate limit + live data snapshots).
const SODEX = "https://mainnet-gw.sodex.dev/api/v1";
const SOSO = "https://openapi.sosovalue.com/openapi/v1";

/* Rate limiting and abuse guards live in lib/rate-limit.ts (shared counter, trusted IP). */

/** AI routes cost quota: only this site's own pages may call them, and one global ceiling stops a flood from many IPs. */
export function blockedAi(req: { headers: Headers }): string | null {
  const origin = req.headers.get("origin");
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host")); } catch { ok = false; }
    if (!ok) return "Not allowed.";
  } else if (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") return "Not allowed.";
  if (limited("ai:all", 240, 60_000)) return "The AI is busy right now. Please try again in a minute.";
  return null;
}

/* ───────── live data gathered server-side; only what these APIs return reaches the model ───────── */
export const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const fmt = (n: number) => (n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n >= 1 ? n.toFixed(4) : n.toPrecision(4));
const abortable = () => AbortSignal.timeout(6000);

export async function sodexSnapshot(): Promise<string | null> {
  try {
    const r = await fetch(`${SODEX}/spot/markets/tickers`, { cache: "no-store", signal: abortable() });
    if (!r.ok) return null;
    const j = await r.json();
    const rows = (Array.isArray(j?.data) ? j.data : []).map((t: any) => ({
      pair: String(t.symbol).replace(/^v/, "").replace(/^W/, "").replace("_vUSDC", "/USDC"),
      last: num(t.lastPx), chg: num(t.changePct), vol: num(t.quoteVolume),
    })).filter((t: any) => t.last > 0);
    if (!rows.length) return null;
    const byVol = [...rows].sort((a, b) => b.vol - a.vol).slice(0, 8);
    const up = [...rows].sort((a, b) => b.chg - a.chg).slice(0, 3);
    const down = [...rows].sort((a, b) => a.chg - b.chg).slice(0, 3);
    const line = (t: any) => `${t.pair} ${fmt(t.last)} (${t.chg >= 0 ? "+" : ""}${t.chg.toFixed(2)}%, 24h vol $${Math.round(t.vol).toLocaleString("en-US")})`;
    return `SoDEX spot (mainnet), ${rows.length} pairs quoted in USDC.\nTop by 24h volume: ${byVol.map(line).join("; ")}\nBiggest gainers: ${up.map(line).join("; ")}\nBiggest losers: ${down.map(line).join("; ")}`;
  } catch { return null; }
}

export async function sosoSnapshot(): Promise<string | null> {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) return null;
  const h = { "x-soso-api-key": key, accept: "application/json" };
  const get = async (path: string) => {
    try { const r = await fetch(`${SOSO}${path}`, { headers: h, next: { revalidate: 120 }, signal: abortable() }); if (!r.ok) return null; const j = await r.json(); return j?.data ?? j; } catch { return null; }
  };
  const [news, etf] = await Promise.all([get("/news/hot"), get("/etfs/summary-history?symbol=BTC&country_code=US&limit=3")]);
  const list = (d: any): any[] => (Array.isArray(d) ? d : Array.isArray(d?.list) ? d.list : []);
  const parts: string[] = [];
  const n = list(news).slice(0, 5).map((x) => `- ${String(x.title ?? "").replace(/[\r\n]+/g, " ").slice(0, 160)}`).filter((x) => x.length > 2);
  if (n.length) parts.push(`SoSoValue hot news:\n${n.join("\n")}`);
  const e = list(etf).slice(0, 3).map((x) => `${String(x.date ?? "").slice(0, 10)}: ${num(x.total_net_inflow) >= 0 ? "+" : "-"}$${Math.round(Math.abs(num(x.total_net_inflow)) / 1e6)}M`);
  if (e.length) parts.push(`US spot BTC ETF daily net inflow (SoSoValue): ${e.join(", ")}`);
  return parts.length ? parts.join("\n") : null;
}

