/**
 * Calculates the required position size given a risk amount in USDC,
 * an entry price, and a stop loss price.
 * 
 * Formula: Position Size = Risk Amount / |Entry Price - Stop Loss Price|
 */
export function calcPositionSize(riskUsdc: number, entryPrice: number, slPrice: number): number {
  if (entryPrice <= 0 || slPrice <= 0 || riskUsdc <= 0) return 0;
  const priceDiff = Math.abs(entryPrice - slPrice);
  if (priceDiff === 0) return 0;
  return riskUsdc / priceDiff;
}

/**
 * Calculates a Take Profit price based on a Risk/Reward Ratio.
 */
export function calcTakeProfit(entryPrice: number, slPrice: number, rrRatio: number, side: 'BUY' | 'SELL'): number {
  if (entryPrice <= 0 || slPrice <= 0 || rrRatio <= 0) return 0;
  const riskPerUnit = Math.abs(entryPrice - slPrice);
  const reward = riskPerUnit * rrRatio;
  return side === 'BUY' ? entryPrice + reward : entryPrice - reward;
}

/**
 * Calculate the PnL of a simulated trade
 */
export function calcPnL(entryPrice: number, exitPrice: number, qty: number, side: 'BUY' | 'SELL'): number {
  if (side === 'BUY') {
    return (exitPrice - entryPrice) * qty;
  } else {
    return (entryPrice - exitPrice) * qty;
  }
}

/**
 * Generates a mock AI Trade Bias based on price change and volume
 */
export function generateAIBias(priceChangePct: number, quoteVolume: number): { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL', confidence: number, reasoning: string, expectedRR: string, winProbability: string } {
  if (priceChangePct > 3 && quoteVolume > 500000) {
    return { bias: 'BULLISH', confidence: 85, reasoning: 'Strong momentum with high volume suggests continuation.', expectedRR: '1:3.5', winProbability: '68%' };
  } else if (priceChangePct < -3 && quoteVolume > 500000) {
    return { bias: 'BEARISH', confidence: 82, reasoning: 'Heavy sell pressure breaking short-term support.', expectedRR: '1:3.0', winProbability: '65%' };
  } else if (priceChangePct > 1) {
    return { bias: 'BULLISH', confidence: 60, reasoning: 'Slight uptrend, but lacks volume confirmation.', expectedRR: '1:2.0', winProbability: '52%' };
  } else if (priceChangePct < -1) {
    return { bias: 'BEARISH', confidence: 60, reasoning: 'Slight downtrend, monitor for breakdown.', expectedRR: '1:2.0', winProbability: '50%' };
  } else {
    return { bias: 'NEUTRAL', confidence: 50, reasoning: 'Choppy consolidation phase. Wait for a breakout.', expectedRR: '1:1.5', winProbability: '40%' };
  }
}
