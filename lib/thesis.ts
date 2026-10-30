/**
 * AI thesis layer: Gemini when GEMINI_API_KEY is set, else deterministic rules.
 */
import type { Thesis } from '@/types/flow';
import { buildRuleThesis, type SignalInputs } from '@/lib/signal';

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function generateThesis(input: SignalInputs): Promise<Thesis> {
  const fallback = buildRuleThesis(input);
  if (!hasGeminiKey()) return fallback;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
    const prompt = `You are FlowSentinel, a cautious one-person crypto fund desk.
Given SoSoValue data, produce ONE daily trade thesis as JSON only (no markdown).

DATA:
- BTC US ETF latest net inflow USD: ${input.etfBtc.latest?.totalNetInflow ?? 'null'} (source ${input.etfBtc.meta.source})
- ETH US ETF latest net inflow USD: ${input.etfEth.latest?.totalNetInflow ?? 'null'} (source ${input.etfEth.meta.source})
- ssiMAG7 price: ${input.ssi.price}, 24h change fraction: ${input.ssi.changePct24h} (source ${input.ssi.meta.source})
- News shock active: ${input.news.shockActive}
- Headlines: ${input.news.items.slice(0, 5).map((n) => n.title).join(' | ')}
- Market: ${input.market.tickers.map((t) => `${t.symbol}=${t.lastPrice}`).join(', ')} (source ${input.market.meta.source})

RULES:
- side must be LONG, SHORT, or FLAT
- symbol must be vBTC_vUSDC or vETH_vUSDC
- confidence 0-100 integer
- plainEnglish: 2-4 sentences, cite which flows/news drove the call
- entry/stopLoss/takeProfit: real dollar numbers consistent with side
- If news shock or weak conviction, prefer FLAT

JSON shape:
{"side":"LONG"|"SHORT"|"FLAT","symbol":"vBTC_vUSDC"|"vETH_vUSDC","confidence":70,"plainEnglish":"...","entry":0,"stopLoss":0,"takeProfit":0,"horizonHours":24}`;

    const res = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = (res as { text?: string }).text ?? String((res as { response?: { text?: () => string } }).response?.text?.() ?? '');
    const parsed = extractJson(text);
    if (!parsed) return fallback;

    const side = parsed.side === 'LONG' || parsed.side === 'SHORT' || parsed.side === 'FLAT' ? parsed.side : fallback.side;
    const symbol = parsed.symbol === 'vETH_vUSDC' ? 'vETH_vUSDC' : 'vBTC_vUSDC';
    return {
      ...fallback,
      side,
      symbol,
      confidence: Math.round(Math.max(0, Math.min(100, Number(parsed.confidence ?? fallback.confidence)))),
      plainEnglish: String(parsed.plainEnglish ?? fallback.plainEnglish),
      entry: Number(parsed.entry ?? fallback.entry) || fallback.entry,
      stopLoss: Number(parsed.stopLoss ?? fallback.stopLoss) || fallback.stopLoss,
      takeProfit: Number(parsed.takeProfit ?? fallback.takeProfit) || fallback.takeProfit,
      horizonHours: Number(parsed.horizonHours ?? 24) || 24,
      engine: 'gemini',
      drivers: fallback.drivers,
    };
  } catch {
    return fallback;
  }
}
