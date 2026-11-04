/**
 * AI thesis layer: Gemini when GEMINI_API_KEY is set, else deterministic rules.
 * Server-only. Cached 5 min. Rate-limit → rules.
 */
import type { Thesis } from '@/types/flow';
import { buildRuleThesis, type SignalInputs } from '@/lib/signal';
import {
  normalizeConfidence,
  normalizeTradeLevels,
} from '@/lib/trade-levels';
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
- plainEnglish: 2-4 sentences; mention headline topics by title words only (never raw numeric ids)
- citedNewsIds: array of news ids you relied on (internal only)
- entry/stopLoss/takeProfit: distinct dollar numbers consistent with side and SoDEX last (LONG: stop<entry<target; SHORT: target<entry<stop). Never set them equal for LONG/SHORT.
- If news shock or weak conviction, prefer FLAT with confidence <= 55

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
    const citedTitles = cited
      .map((id) => input.news.items.find((x) => x.id === id)?.title)
      .filter(Boolean)
      .map((title) => String(title).slice(0, 80));
    const citeNote =
      citedTitles.length > 0
        ? ` Related: ${citedTitles.join('; ')}.`
        : '';

    const levels = normalizeTradeLevels({
      side,
      entry: Number(parsed.entry ?? fallback.entry) || fallback.entry,
      stopLoss: Number(parsed.stopLoss ?? fallback.stopLoss) || fallback.stopLoss,
      takeProfit: Number(parsed.takeProfit ?? fallback.takeProfit) || fallback.takeProfit,
    });
    // Prefer FLAT when model invented a directional call without a valid setup
    const finalSide = side !== 'FLAT' && !levels.hasSetup ? 'FLAT' : side;
    const finalLevels =
      finalSide === 'FLAT'
        ? normalizeTradeLevels({
            side: 'FLAT',
            entry: levels.entry || fallback.entry,
            stopLoss: levels.entry || fallback.entry,
            takeProfit: levels.entry || fallback.entry,
          })
        : levels;

    let plain = String(parsed.plainEnglish ?? fallback.plainEnglish);
    // Strip raw numeric news ids like [2117626848089169921]
    plain = plain.replace(/\[\d{6,}\]/g, '').replace(/\s{2,}/g, ' ').trim();
    if (finalSide === 'FLAT' || !finalLevels.hasSetup) {
      plain = plain || 'No trade setup today. Waiting for a clearer signal.';
      if (!/no trade setup/i.test(plain)) {
        plain = `${plain} No trade setup.`;
      }
    }

    return {
      ...fallback,
      side: finalSide,
      symbol,
      confidence: normalizeConfidence(
        Number(parsed.confidence ?? fallback.confidence),
        {
          side: finalSide,
          newsShock: input.news.shockActive,
          hasSetup: finalLevels.hasSetup,
        },
      ),
      plainEnglish: `${plain}${citeNote}`,
      entry: finalLevels.entry,
      stopLoss: finalLevels.stopLoss,
      takeProfit: finalLevels.takeProfit,
      horizonHours: Number(parsed.horizonHours ?? 24) || 24,
      engine: 'gemini',
      drivers: {
        ...fallback.drivers,
        topHeadlines: [...citedTitles, ...fallback.drivers.topHeadlines].slice(0, 5),
      },
    };
  } catch (e) {
    if (e instanceof GeminiRateLimitError) {
      console.warn('[thesis] Gemini rate-limited - rules fallback');
    } else {
      console.warn('[thesis] Gemini unavailable - rules fallback');
    }
    return fallback;
  }
}
