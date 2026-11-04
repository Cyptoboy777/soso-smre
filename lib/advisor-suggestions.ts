/**
 * Validate AI / advisor structured trade suggestions before UI prefill.
 * Advisor may only prefill — never submit. Guards prompt-injection shapes.
 */
import { TRADE_SYMBOL_ALLOWLIST } from "@/lib/trade-guard";
import {
  hasValidTradeSetup,
  normalizeTradeLevels,
  normalizeConfidence,
  type TradeSide,
} from "@/lib/trade-levels";

export type AdvisorSuggestion = {
  side: "LONG" | "SHORT" | "FLAT";
  symbol: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reasoning: string;
  title?: string;
};

const SIDES = new Set(["LONG", "SHORT", "FLAT"]);

function finitePos(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

/**
 * Parse and validate a single suggestion object.
 * Rejects unknown symbols, non-enum sides, non-finite prices, huge strings.
 */
export function validateAdvisorSuggestion(
  raw: unknown,
): { ok: true; suggestion: AdvisorSuggestion } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Suggestion must be an object" };
  }
  const r = raw as Record<string, unknown>;
  const side = String(r.side ?? "").toUpperCase();
  if (!SIDES.has(side)) {
    return { ok: false, error: "side must be LONG, SHORT, or FLAT" };
  }
  const symbol = String(r.symbol ?? "").trim();
  if (!TRADE_SYMBOL_ALLOWLIST.has(symbol)) {
    return { ok: false, error: `symbol not allowlisted: ${symbol}` };
  }
  const entry = finitePos(r.entry);
  const stopLoss = finitePos(r.stopLoss);
  const takeProfit = finitePos(r.takeProfit);
  if (entry == null || stopLoss == null || takeProfit == null) {
    return { ok: false, error: "entry, stopLoss, takeProfit must be positive numbers" };
  }
  const levels = normalizeTradeLevels({
    side: side as TradeSide,
    entry,
    stopLoss,
    takeProfit,
  });
  if (side !== "FLAT" && !levels.hasSetup) {
    return { ok: false, error: "No valid trade setup (entry/stop/target)" };
  }
  if (side !== "FLAT" && !hasValidTradeSetup(side as TradeSide, levels.entry, levels.stopLoss, levels.takeProfit)) {
    return { ok: false, error: "entry/stop/target geometry invalid for side" };
  }
  let confidence = normalizeConfidence(Number(r.confidence), {
    side: side as TradeSide,
    hasSetup: levels.hasSetup,
  });
  const reasoning = String(r.reasoning ?? r.plainEnglish ?? "")
    .slice(0, 800)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const title =
    r.title != null
      ? String(r.title).slice(0, 120).replace(/[\u0000-\u001F]/g, "")
      : undefined;

  // Reject obvious injection payloads posing as instructions
  const lower = reasoning.toLowerCase();
  if (
    /\b(ignore (all|previous) instructions|system prompt|exfiltrat|private key|api[_ ]?key)\b/.test(
      lower,
    )
  ) {
    return { ok: false, error: "Suggestion text failed safety filter" };
  }

  return {
    ok: true,
    suggestion: {
      side: side as AdvisorSuggestion["side"],
      symbol,
      entry: levels.entry,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      confidence,
      reasoning,
      title,
    },
  };
}

export function validateAdvisorSuggestionList(raw: unknown): AdvisorSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: AdvisorSuggestion[] = [];
  for (const item of raw.slice(0, 5)) {
    const v = validateAdvisorSuggestion(item);
    if (v.ok) out.push(v.suggestion);
  }
  return out;
}
