import type { TradeSetup, RiskSettings } from '@/types/sodex';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  riskMeter: 'GREEN' | 'YELLOW' | 'RED';
}

/**
 * Validates a trade setup against the Risk Management Rules.
 */
export function validateTradeRisk(
  setup: TradeSetup,
  settings: RiskSettings,
  capital: number,
  dailyPnL: number
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check valid inputs
  if (setup.entry <= 0) errors.push('Entry price must be greater than 0.');
  if (setup.sl <= 0) errors.push('Stop Loss must be set.');
  if (setup.tp.length === 0 || setup.tp.every(t => t <= 0)) {
    errors.push('At least one Take Profit must be set.');
  }

  // Directional checks
  if (setup.side === 'BUY') {
    if (setup.sl >= setup.entry) errors.push('For BUY, Stop Loss must be below Entry.');
    setup.tp.forEach((t, i) => {
      if (t > 0 && t <= setup.entry) errors.push(`TP${i+1} must be above Entry for BUY.`);
    });
  } else {
    if (setup.sl <= setup.entry) errors.push('For SELL, Stop Loss must be above Entry.');
    setup.tp.forEach((t, i) => {
      if (t > 0 && t >= setup.entry) errors.push(`TP${i+1} must be below Entry for SELL.`);
    });
  }

  // Calculate Risk / Reward if inputs valid
  if (errors.length === 0) {
    const riskDiff = Math.abs(setup.entry - setup.sl);
    const primaryTp = setup.tp.find(t => t > 0) || 0; // Evaluate R:R based on nearest active TP
    const rewardDiff = Math.abs(primaryTp - setup.entry);
    
    if (riskDiff > 0 && rewardDiff > 0) {
      const rr = rewardDiff / riskDiff;
      if (rr < settings.minRR) {
        warnings.push(`R:R is ${(rr).toFixed(1)} (Below minimum 1:${settings.minRR})`);
      }
    }
  }

  // Daily Risk limit
  const maxDailyLossAllowed = capital * (settings.maxDailyRiskPct / 100);
  if (dailyPnL < -maxDailyLossAllowed) {
    errors.push(`Daily Drawdown limit hit (-${settings.maxDailyRiskPct}%). Trading disabled.`);
  }

  const valid = errors.length === 0;
  
  let riskMeter: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  if (errors.length > 0) riskMeter = 'RED';
  else if (warnings.length > 0) riskMeter = 'YELLOW';

  return { valid, warnings, errors, riskMeter };
}

/**
 * Calculates position size based on exact Risk Amount, entry, and stop loss.
 */
export function calculatePositionSizeByRisk(riskUsdc: number, entry: number, sl: number): number {
  if (entry <= 0 || sl <= 0 || riskUsdc <= 0) return 0;
  const dist = Math.abs(entry - sl);
  if (dist === 0) return 0;
  return riskUsdc / dist;
}

/**
 * Calculates TP arrays based on ATR volatility proxy
 */
export function calculateAtrTargets(entry: number, side: 'BUY' | 'SELL', atrProxy: number) {
  const direction = side === 'BUY' ? 1 : -1;
  const sl = entry - (direction * atrProxy * 1.5); // SL is 1.5 ATR away
  const tp1 = entry + (direction * atrProxy * 2.0); // TP1 is 2.0 ATR
  const tp2 = entry + (direction * atrProxy * 3.5); // TP2 is 3.5 ATR
  const tp3 = entry + (direction * atrProxy * 5.0); // TP3 is 5.0 ATR
  return { sl, tps: [tp1, tp2, tp3] };
}
