/**
 * Deterministic rule-based thesis engine (fallback when GEMINI_API_KEY is absent).
 * Pure functions - unit-tested.
 */
import type {
  EtfPanel,
  MarketPanel,
  NewsPanel,
  SsiPanel,
  Thesis,
  ThesisDrivers,
  ThesisSide,
} from '@/types/flow';
import { pickPrice } from '@/lib/sodex';
import crypto from 'crypto';
import { deriveTradeLevels, normalizeConfidence } from '@/lib/trade-levels';
import {
  buildShortRulePlain,
  sanitizeHeadline,
} from '@/lib/thesis-copy';

export interface SignalInputs {
  etfBtc: EtfPanel;
  etfEth: EtfPanel;
  news: NewsPanel;
  ssi: SsiPanel;
  market: MarketPanel;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function buildDrivers(input: SignalInputs): ThesisDrivers {
  return {
    etfBtcNetInflow: input.etfBtc.latest?.totalNetInflow ?? null,
    etfEthNetInflow: input.etfEth.latest?.totalNetInflow ?? null,
    ssiChangePct: input.ssi.changePct24h,
    newsShock: input.news.shockActive,
    topHeadlines: input.news.items.slice(0, 3).map((n) => sanitizeHeadline(n.title)).filter(Boolean),
  };
}

/**
 * Score from -100 (strong short) to +100 (strong long).
 */
export function scoreFlows(drivers: ThesisDrivers): number {
  let score = 0;
  const btc = drivers.etfBtcNetInflow;
  const eth = drivers.etfEthNetInflow;
  if (btc != null) {
    // ±$200M ≈ ±40 points
    score += clamp(btc / 5_000_000, -40, 40);
  }
  if (eth != null) {
    score += clamp(eth / 3_000_000, -25, 25);
  }
  if (drivers.ssiChangePct != null) {
    // change_pct_24h is a decimal fraction from SoSoValue
    score += clamp(drivers.ssiChangePct * 1000, -20, 20);
  }
  if (drivers.newsShock) score *= 0.35;
  return clamp(score, -100, 100);
}

export function sideFromScore(score: number): ThesisSide {
  if (score >= 18) return 'LONG';
  if (score <= -18) return 'SHORT';
  return 'FLAT';
}

export function confidenceFromScore(score: number): number {
  const mag = Math.abs(score);
  return Math.round(clamp(45 + mag * 0.45, 40, 92));
}

export function buildRuleThesis(input: SignalInputs): Thesis {
  const drivers = buildDrivers(input);
  const score = scoreFlows(drivers);
  const side = sideFromScore(score);
  const preferEth =
    Math.abs(drivers.etfEthNetInflow ?? 0) > Math.abs(drivers.etfBtcNetInflow ?? 0) * 0.6 &&
    Math.abs(drivers.etfEthNetInflow ?? 0) > 20_000_000;
  const symbol = preferEth ? 'vETH_vUSDC' : 'vBTC_vUSDC';
  const entryRaw = pickPrice(input.market, symbol);
  const levels = deriveTradeLevels(side, entryRaw);
  const entry = levels.entry;
  const stopLoss = levels.stopLoss;
  const takeProfit = levels.takeProfit;
  const confidence = normalizeConfidence(confidenceFromScore(score), {
    side,
    newsShock: drivers.newsShock,
    hasSetup: levels.hasSetup,
  });

  const plain = buildShortRulePlain({
    side,
    symbol,
    btcFlow: drivers.etfBtcNetInflow,
    ethFlow: drivers.etfEthNetInflow,
    newsShock: drivers.newsShock,
  });

  return {
    id: `th_${crypto.randomBytes(5).toString('hex')}`,
    createdAt: new Date().toISOString(),
    side,
    symbol,
    plainEnglish: plain,
    confidence,
    entry,
    stopLoss,
    takeProfit,
    drivers,
    engine: 'rules',
    horizonHours: 24,
  };
}
