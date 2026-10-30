/**
 * Deterministic grounded answers from desk snapshot — used when GEMINI is absent
 * and as the source of truth for voice commands.
 */
import type { DeskSnapshot } from '@/types/flow';

export type VoiceLang =
  | 'auto'
  | 'en-US'
  | 'hi-IN'
  | 'es-ES'
  | 'fr-FR'
  | 'pt-BR'
  | 'it-IT'
  | 'zh-CN'
  | 'ja-JP'
  | 'ko-KR';

export const VOICE_LANGS: { id: VoiceLang; label: string; speech: string }[] = [
  { id: 'auto', label: 'Auto', speech: 'en-US' },
  { id: 'en-US', label: 'English', speech: 'en-US' },
  { id: 'hi-IN', label: 'हिन्दी', speech: 'hi-IN' },
  { id: 'es-ES', label: 'Español', speech: 'es-ES' },
  { id: 'fr-FR', label: 'Français', speech: 'fr-FR' },
  { id: 'pt-BR', label: 'Português', speech: 'pt-BR' },
  { id: 'it-IT', label: 'Italiano', speech: 'it-IT' },
  { id: 'zh-CN', label: '中文', speech: 'zh-CN' },
  { id: 'ja-JP', label: '日本語', speech: 'ja-JP' },
  { id: 'ko-KR', label: '한국어', speech: 'ko-KR' },
];

export type VoiceIntent = 'order_blocked' | 'refresh' | 'read_thesis' | 'explain_risk' | 'ticket' | 'risk' | 'flows' | 'news' | 'track' | 'help' | 'ask' | 'thesis' | 'ssi' | 'general';

export function detectIntent(text: string): VoiceIntent {
  const t = text.toLowerCase().trim();
  if (!t) return 'help';
  if (/\b(place|buy|sell|order|execute|trade|confirm)\b/.test(t) && /\b(order|trade|buy|sell|execute|place)\b/.test(t)) {
    return 'order_blocked';
  }
  if (/\b(refresh|reload|update|new thesis|फिर से|रिफ्रेश)\b/.test(t)) return 'refresh';
  if (/\b(risk|gate|drawdown|blocked|pass|explain risk)\b/.test(t)) return 'explain_risk';
  if (/\b(read|speak|aloud|thesis|idea|कहकर|बोलो)\b/.test(t) && /\b(thesis|idea|daily|today)\b/.test(t)) return 'read_thesis';
  if (/\b(ticket|order|entry|stop|target|size|notional)\b/.test(t)) return 'ticket';
  if (/\b(risk|gate|drawdown|position|approve|block)\b/.test(t)) return 'risk';
  if (/\b(etf|flow|inflow|outflow|btc|eth)\b/.test(t)) return 'flows';
  if (/\b(news|headline|shock)\b/.test(t)) return 'news';
  if (/\b(track|record|hit rate|pnl|performance)\b/.test(t)) return 'track';
  if (/\b(help|what can|commands)\b/.test(t)) return 'help';
  return 'ask';
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'unavailable';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

export function groundedAnswer(desk: DeskSnapshot, intent: VoiceIntent, question: string): string {
  const { thesis, risk, etfBtc, etfEth, news, ssi } = desk;
  switch (intent) {
    case 'order_blocked':
      return 'I cannot place orders by voice. Open Confirm and execute, tick the checkbox, then click the order button. Voice never bypasses that step.';
    case 'refresh':
      return 'Refreshing the thesis now.';
    case 'read_thesis':
      return `Today's thesis is ${thesis.side} on ${thesis.symbol} with confidence ${thesis.engine === 'gemini' ? thesis.confidence : thesis.confidence}. ${thesis.plainEnglish}`;
    case 'explain_risk': {
      const fails = risk.checks.filter((c) => !c.passed);
      const passes = risk.checks.filter((c) => c.passed);
      if (risk.approved) {
        return `Risk gate passed. Size ${risk.positionSize} of ${thesis.symbol}, risking $${risk.riskUsd} (${risk.riskPct}% of equity). Checks cleared: ${passes.map((c) => c.label).join(', ')}.`;
      }
      return `Risk gate blocked. Failed: ${fails.map((c) => `${c.label} (${c.detail})`).join('; ') || 'unknown'}.`;
    }
    case 'ticket': {
        const side = thesis.side === 'SHORT' ? 'sell' : thesis.side === 'LONG' ? 'buy' : 'flat';
        return `Order ticket: ${side} ${thesis.symbol}. Entry ${thesis.entry}, stop ${thesis.stopLoss}, take profit ${thesis.takeProfit}. Risk size ${risk.positionSize}, notional about ${Math.round(risk.notionalUsd)} dollars, risk ${risk.riskPct.toFixed(2)} percent of equity. Gate is ${risk.approved ? 'approved' : 'blocked'}. ${risk.checks.filter(c=>!c.passed).map(c=>c.label).join(', ') || 'All checks clear'}. Voice narration only — confirm on the desk for SoDEX testnet. Voice never places orders.`;
      }
      case 'risk': {
        const failed = risk.checks.filter((c) => !c.passed);
        return `Risk gate ${risk.approved ? 'passed' : 'blocked'}. Equity ${risk.equityUsd}, size ${risk.positionSize}, notional ${Math.round(risk.notionalUsd)}, risk budget ${risk.riskPct.toFixed(2)} percent. ${failed.length ? 'Failed: ' + failed.map((c) => c.label + ' — ' + c.detail).join('; ') : 'All checks passed'}. Confirm required before any testnet order.`;
      }
      case 'flows':
      return `BTC US ETF latest net ${money(etfBtc.latest?.totalNetInflow)} (${etfBtc.meta.source}). ETH US ETF latest net ${money(etfEth.latest?.totalNetInflow)} (${etfEth.meta.source}). ssiMAG7 ${ssi.price ?? 'n/a'} (${ssi.meta.source}).`;
    case 'news': {
      const heads = news.items.slice(0, 3).map((n) => n.title).join('. ');
      return news.shockActive
        ? `News-shock pause is active. Top headlines: ${heads || 'none'}.`
        : `No shock pause. Top headlines: ${heads || 'none'}.`;
    }
    case 'track':
      return 'Open the Track record page for logged ideas, outcomes, and hit rate. Outcomes resolve only from real mark prices — never invented PnL.';
    case 'help':
      return "Try: 'read thesis', 'explain risk', 'read the ticket', 'ETF flows', 'news', 'track record', or 'refresh thesis'. I will not place orders by voice.";
    case 'ask':
    default:
      return `Based on today's desk: thesis ${thesis.side} ${thesis.symbol}, confidence ${thesis.confidence}. ${thesis.plainEnglish} Risk gate is ${risk.approved ? 'pass' : 'blocked'}. Question was: ${question}`;
  }
}

export async function answerWithOptionalGemini(
  desk: DeskSnapshot,
  question: string,
  lang: VoiceLang,
): Promise<{ answer: string; intent: VoiceIntent; engine: 'gemini' | 'rules' }> {
  const intent = detectIntent(question);
  if (intent !== 'ask') {
    return { answer: groundedAnswer(desk, intent, question), intent, engine: 'rules' };
  }

  const fallback = groundedAnswer(desk, 'ask', question);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { answer: fallback, intent, engine: 'rules' };

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: key });
    const langHint = lang === 'auto' ? 'the user language' : VOICE_LANGS.find((l) => l.id === lang)?.label || 'English';
    const prompt = `You are FlowSentinel voice desk assistant. Answer briefly (2-5 sentences) in ${langHint}.
Use ONLY this data. Never invent prices or PnL. Never claim an order was placed.
If asked to place/buy/sell/execute, refuse and say confirmation click is required.

DATA:
Thesis: ${JSON.stringify(desk.thesis)}
Risk: ${JSON.stringify(desk.risk)}
BTC ETF: ${JSON.stringify(desk.etfBtc.latest)} source=${desk.etfBtc.meta.source}
ETH ETF: ${JSON.stringify(desk.etfEth.latest)} source=${desk.etfEth.meta.source}
SSI: ${JSON.stringify(desk.ssi)}
News shock: ${desk.news.shockActive}; headlines: ${desk.news.items.slice(0, 4).map((n) => n.title).join(' | ')}

USER: ${question}`;

    const res = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text =
      (res as { text?: string }).text ||
      String((res as { response?: { text?: () => string } }).response?.text?.() ?? '');
    if (!text.trim()) return { answer: fallback, intent, engine: 'rules' };
    return { answer: text.trim(), intent, engine: 'gemini' };
  } catch {
    return { answer: fallback, intent, engine: 'rules' };
  }
}
