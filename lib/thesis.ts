/**
 * AI thesis layer: Gemini when GEMINI_API_KEY is set, else deterministic rules.
 * Server-only. Cached 5 min. Rate-limit → rules.
 */
import type { Thesis } from '@/types/flow';
import { buildRuleThesis, type SignalInputs } from '@/lib/signal';
import {
  extractJsonObject,
  geminiGenerate,
  GeminiRateLimitError,
  hasGeminiKey,
  GEMINI_FAST_MODEL,
} from '@/lib/gemini';

export { hasGeminiKey, GEMINI_FAST_MODEL };

export async function generateThesis(input: SignalInputs): Promise<Thesis> {
  const fallback = buildRuleThesis(input);
  if (!hasGeminiKey()) return fallback;

  const cacheKey = [
    'thesis',
    input.etfBtc.latest?.totalNetInflow ?? 'x',
    input.etfEth.latest?.totalNetInflow ?? 'x',
    input.ssi.changePct24h ?? 'x',
    input.news.shockActive ? '1' : '0',
    input.news.items[0]?.id ?? 'n',
    input.market.tickers[0]?.lastPrice ?? 'p',
  ].join('|');

  try {
    const prompt = `You are FlowSentinel, a cautious one-person crypto fund desk.
Given SoSoValue data, produce ONE daily trade thesis as JSON only.

DATA:
- BTC US ETF latest net inflow USD: ${input.etfBtc.latest?.totalNetInflow ?? 'null'} (source ${input.etfBtc.meta.source})
- ETH US ETF latest net inflow USD: ${input.etfEth.latest?.totalNetInflow ?? 'null'} (source ${input.etfEth.meta.source})
- ssiMAG7 price: ${input.ssi.price}, 24h change fraction: ${input.ssi.changePct24h} (source ${input.ssi.meta.source})
- News shock active: ${input.news.shockActive}
- Headlines with ids: ${input.news.items
      .slice(0, 6)
      .map((n) => `{id:${n.id}, title:${JSON.stringify(n.title)}}`)
      .join(' | ')}
- Market: ${input.market.tickers.map((t) => `${t.symbol}=${t.lastPrice}`).join(', ')} (source ${input.market.meta.source})

RULES:
- side must be LONG, SHORT, or FLAT
- symbol must be vBTC_vUSDC or vETH_vUSDC
- confidence 0-100 integer
- plainEnglish: 2-4 sentences; cite news by id like [news:ID] and name the ETF/SSI figures
- citedNewsIds: array of news ids you relied on
- entry/stopLoss/takeProfit: dollar numbers consistent with side and SoDEX last
- If news shock or weak conviction, prefer FLAT

JSON shape:
{"side":"LONG"|"SHORT"|"FLAT","symbol":"vBTC_vUSDC"|"vETH_vUSDC","confidence":70,"plainEnglish":"...","citedNewsIds":["..."],"entry":0,"stopLoss":0,"takeProfit":0,"horizonHours":24}`;

    const text = await geminiGenerate({
      prompt,
      cacheKey,
      system: 'Return only valid JSON. No markdown.',
    });
    const parsed = extractJsonObject(text);
    if (!parsed) return fallback;

    const side =
      parsed.side === 'LONG' || parsed.side === 'SHORT' || parsed.side === 'FLAT'
        ? parsed.side
        : fallback.side;
    const symbol = parsed.symbol === 'vETH_vUSDC' ? 'vETH_vUSDC' : 'vBTC_vUSDC';
    const cited = Array.isArray(parsed.citedNewsIds)
      ? (parsed.citedNewsIds as unknown[]).map(String)
      : [];
    const citeNote =
      cited.length > 0
        ? ` Cited news: ${cited
            .map((id) => {
              const n = input.news.items.find((x) => x.id === id);
              return n ? `[${id}] ${n.title.slice(0, 60)}` : `[${id}]`;
            })
            .join('; ')}.`
        : '';

    let entry = Number(parsed.entry ?? fallback.entry) || fallback.entry;
    let stopLoss = Number(parsed.stopLoss ?? fallback.stopLoss) || fallback.stopLoss;
    let takeProfit = Number(parsed.takeProfit ?? fallback.takeProfit) || fallback.takeProfit;
    if (side === 'FLAT') {
      stopLoss = entry;
      takeProfit = entry;
    }
    return {
      ...fallback,
      side,
      symbol,
      confidence: Math.round(Math.max(0, Math.min(100, Number(parsed.confidence ?? fallback.confidence)))),
      plainEnglish: `${String(parsed.plainEnglish ?? fallback.plainEnglish)}${citeNote}`,
      entry,
      stopLoss,
      takeProfit,
      horizonHours: Number(parsed.horizonHours ?? 24) || 24,
      engine: 'gemini',
      drivers: {
        ...fallback.drivers,
        topHeadlines: [
          ...cited
            .map((id) => input.news.items.find((x) => x.id === id)?.title)
            .filter(Boolean)
            .map(String),
          ...fallback.drivers.topHeadlines,
        ].slice(0, 5),
      },
    };
  } catch (e) {
    if (e instanceof GeminiRateLimitError) {
      console.warn('[thesis] Gemini rate-limited — rules fallback');
    } else {
      console.warn('[thesis] Gemini unavailable — rules fallback');
    }
    return fallback;
  }
}
