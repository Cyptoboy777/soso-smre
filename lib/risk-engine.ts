/**
 * Deterministic risk gate for FlowSentinel.
 * Inspired by sodex-grok-trader risk engine ideas (sizing, drawdown, news pause)
 * but rewritten in TypeScript for the Next.js desk — no Python dependency.
 */
import type { NewsPanel, RiskCheck, RiskDecision, Thesis } from '@/types/flow';

export interface RiskParams {
  equityUsd: number;
  riskPerTradePct: number; // e.g. 1 = 1%
  maxDrawdownPct: number; // e.g. 5
  currentDrawdownPct: number;
  minConfidence: number;
  minRewardRisk: number;
  maxPositionPct: number; // max notional as % of equity
  newsShockBlocks: boolean;
}

export const DEFAULT_RISK_PARAMS: RiskParams = {
  equityUsd: 10_000,
  riskPerTradePct: 1,
  maxDrawdownPct: 5,
  currentDrawdownPct: 0,
  minConfidence: 55,
  minRewardRisk: 1.5,
  maxPositionPct: 25,
  newsShockBlocks: true,
};

export function evaluateRisk(
  thesis: Thesis,
  news: NewsPanel,
  params: Partial<RiskParams> = {},
): RiskDecision {
  const p: RiskParams = { ...DEFAULT_RISK_PARAMS, ...params };
  const checks: RiskCheck[] = [];

  // 1. FLAT thesis
  const notFlat = thesis.side !== 'FLAT';
  checks.push({
    id: 'direction',
    label: 'Directional thesis',
    passed: notFlat,
    detail: notFlat ? `${thesis.side} on ${thesis.symbol}` : 'Thesis is FLAT — no order',
  });

  // 2. Confidence floor
  const confOk = thesis.confidence >= p.minConfidence;
  checks.push({
    id: 'confidence',
    label: `Confidence ≥ ${p.minConfidence}`,
    passed: confOk,
    detail: `Score ${thesis.confidence}`,
  });

  // 3. Stop / target geometry
  const entry = thesis.entry;
  const sl = thesis.stopLoss;
  const tp = thesis.takeProfit;
  let geometryOk = entry > 0 && sl > 0 && tp > 0;
  let geoDetail = '';
  if (!geometryOk) {
    geoDetail = 'Entry / stop / target must be positive';
  } else if (thesis.side === 'LONG') {
    geometryOk = sl < entry && tp > entry;
    geoDetail = geometryOk ? 'SL below entry, TP above' : 'LONG requires SL < entry < TP';
  } else if (thesis.side === 'SHORT') {
    geometryOk = sl > entry && tp < entry;
    geoDetail = geometryOk ? 'SL above entry, TP below' : 'SHORT requires TP < entry < SL';
  } else {
    geoDetail = 'No geometry for FLAT';
    geometryOk = false;
  }
  checks.push({
    id: 'geometry',
    label: 'Stop / target geometry',
    passed: geometryOk,
    detail: geoDetail,
  });

  // 4. Reward : risk
  const riskDist = Math.abs(entry - sl);
  const rewardDist = Math.abs(tp - entry);
  const rr = riskDist > 0 ? rewardDist / riskDist : 0;
  const rrOk = geometryOk && rr >= p.minRewardRisk;
  checks.push({
    id: 'reward_risk',
    label: `Reward:risk ≥ ${p.minRewardRisk}`,
    passed: rrOk,
    detail: rrOk ? `${rr.toFixed(2)} R` : `Only ${rr.toFixed(2)} R`,
  });

  // 5. Max drawdown lockout
  const ddOk = p.currentDrawdownPct < p.maxDrawdownPct;
  checks.push({
    id: 'max_drawdown',
    label: `Drawdown < ${p.maxDrawdownPct}%`,
    passed: ddOk,
    detail: `Current drawdown ${p.currentDrawdownPct.toFixed(2)}%`,
  });

  // 6. News-shock pause
  const shock = news.shockActive || thesis.drivers.newsShock;
  const newsOk = !(p.newsShockBlocks && shock);
  checks.push({
    id: 'news_shock',
    label: 'News-shock pause',
    passed: newsOk,
    detail: newsOk
      ? 'No blocking shock headlines'
      : 'Shock headline detected — new entries paused',
  });

  // Position sizing from risk budget
  const riskBudget = p.equityUsd * (p.riskPerTradePct / 100);
  let positionSize = 0;
  let notionalUsd = 0;
  let riskUsd = 0;
  if (geometryOk && riskDist > 0 && notFlat) {
    positionSize = riskBudget / riskDist;
    notionalUsd = positionSize * entry;
    const maxNotional = p.equityUsd * (p.maxPositionPct / 100);
    if (notionalUsd > maxNotional) {
      positionSize = maxNotional / entry;
      notionalUsd = maxNotional;
    }
    riskUsd = positionSize * riskDist;
  }

  const sizeOk = positionSize > 0 && notionalUsd > 0;
  checks.push({
    id: 'sizing',
    label: 'Position size',
    passed: sizeOk,
    detail: sizeOk
      ? `${positionSize.toPrecision(4)} @ $${entry.toLocaleString()} (risk $${riskUsd.toFixed(2)})`
      : 'Unable to size — check geometry',
  });

  const approved = checks.every((c) => c.passed);

  return {
    approved,
    checks,
    positionSize: Number(positionSize.toPrecision(6)),
    notionalUsd: Number(notionalUsd.toFixed(2)),
    riskUsd: Number(riskUsd.toFixed(2)),
    riskPct: p.equityUsd > 0 ? Number(((riskUsd / p.equityUsd) * 100).toFixed(3)) : 0,
    equityUsd: p.equityUsd,
  };
}
