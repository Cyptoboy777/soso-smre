/* Deterministic risk maths for the SoSwapDEX "Skills" tab. Pure functions, no network, no AI.
 * The AI only EXPLAINS these results; it never changes a grade or a number. */

export type Level = { price: number; size: number };
export type Grade = 'safe' | 'caution' | 'avoid';
export type Flag = { sev: 'info' | 'warn' | 'bad'; text: string };

const fin = (n: number) => (Number.isFinite(n) ? n : 0);

/** Walk one side of the book with a USD budget (buy walks asks, sell walks bids). */
export function walkBook(levels: Level[], usd: number) {
  let left = usd, qty = 0, spent = 0;
  for (const l of levels) {
    if (left <= 0 || l.price <= 0 || l.size <= 0) continue;
    const take = Math.min(l.size, left / l.price);
    qty += take; spent += take * l.price; left -= take * l.price;
  }
  const best = levels[0]?.price ?? 0;
  const avg = qty > 0 ? spent / qty : 0;
  const coverage = usd > 0 ? Math.min(1, spent / usd) : 0;
  return { qty, spent, avg, best, coverage, impactPct: best > 0 && avg > 0 ? Math.abs(avg - best) / best * 100 : 0 };
}

export type ScanIn = {
  side: 'buy' | 'sell'; usd: number;
  bids: Level[]; asks: Level[];
  open: number; high: number; low: number; last: number; quoteVol: number;
  takerFee: number; halted: boolean;
};
export type ScanOut = {
  grade: Grade; flags: Flag[];
  spreadPct: number; impactPct: number; coveragePct: number; rangePct: number; volShare: number;
  roundTripCostPct: number; avgPx: number;
};

export function scanTrade(i: ScanIn): ScanOut {
  const flags: Flag[] = [];
  const bid = i.bids[0]?.price ?? 0, ask = i.asks[0]?.price ?? 0;
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : i.last;
  const spreadPct = bid > 0 && ask > 0 ? ((ask - bid) / mid) * 100 : 0;
  const w = walkBook(i.side === 'buy' ? i.asks : i.bids, i.usd);
  const rangePct = i.low > 0 ? ((i.high - i.low) / i.low) * 100 : 0;
  const volShare = i.quoteVol > 0 ? (i.usd / i.quoteVol) * 100 : 0;
  const feePct = fin(i.takerFee) * 100;
  const roundTripCostPct = spreadPct + w.impactPct * 2 + feePct * 2; // in + out, rough

  let bad = 0, warn = 0;
  const add = (sev: Flag['sev'], text: string) => { flags.push({ sev, text }); if (sev === 'bad') bad++; if (sev === 'warn') warn++; };

  if (i.halted) add('bad', 'This market is not in TRADING status right now.');
  if (!bid || !ask) add('bad', 'The order book is empty on one side. A market order could fill at a very bad price.');
  if (i.usd > 0 && w.coverage < 0.999) add('bad', `Visible depth covers only ${(w.coverage * 100).toFixed(0)}% of this size. The rest would not fill or would fill far away.`);
  if (w.impactPct > 2) add('bad', `Price impact is about ${w.impactPct.toFixed(2)}%. You would pay a lot more than the best price.`);
  else if (w.impactPct > 0.5) add('warn', `Price impact is about ${w.impactPct.toFixed(2)}%. Consider splitting the order.`);
  if (spreadPct > 1) add('bad', `Spread is ${spreadPct.toFixed(2)}%. Buying and selling straight back would lose that immediately.`);
  else if (spreadPct > 0.3) add('warn', `Spread is ${spreadPct.toFixed(2)}%, which is wide for a liquid pair.`);
  if (rangePct > 15) add('warn', `The 24h high-to-low range is ${rangePct.toFixed(1)}%: the price is very volatile.`);
  if (volShare > 2) add('warn', `This order is ${volShare.toFixed(2)}% of the pair's 24h volume. You may move the market.`);
  if (roundTripCostPct > 1.5) add('warn', `Entering and exiting would cost roughly ${roundTripCostPct.toFixed(2)}% in spread, impact and fees before the price moves at all.`);
  if (!flags.length) add('info', 'No liquidity, spread or volatility warnings at this size.');

  const grade: Grade = bad > 0 ? 'avoid' : warn > 0 ? 'caution' : 'safe';
  return { grade, flags, spreadPct, impactPct: w.impactPct, coveragePct: w.coverage * 100, rangePct, volShare, roundTripCostPct, avgPx: w.avg };
}

/** Fixed-fractional position sizing: risk a set % of equity between entry and stop. */
export function sizePosition(i: { equity: number; riskPct: number; entry: number; stop: number; feePct?: number }) {
  const { equity, riskPct, entry, stop } = i;
  if (!(equity > 0 && riskPct > 0 && entry > 0 && stop > 0) || entry === stop) return null;
  const long = stop < entry;
  const perUnit = Math.abs(entry - stop) + entry * (fin(i.feePct ?? 0) / 100) * 2; // loss per unit incl. in+out fees
  const maxLoss = equity * (riskPct / 100);
  const qty = maxLoss / perUnit;
  const notional = qty * entry;
  const flags: Flag[] = [];
  if (notional > equity) flags.push({ sev: 'bad', text: 'This position is bigger than your balance. The stop is too tight for this risk %, or you would need leverage, which spot does not offer.' });
  if (riskPct > 2) flags.push({ sev: 'warn', text: `Risking ${riskPct}% per trade is aggressive. Many traders cap it at 1–2%.` });
  const stopDistPct = (Math.abs(entry - stop) / entry) * 100;
  if (stopDistPct < 0.5) flags.push({ sev: 'warn', text: `A stop only ${stopDistPct.toFixed(2)}% away is likely to be hit by normal noise.` });
  if (!long) flags.push({ sev: 'info', text: 'Stop is above entry: spot SoDEX cannot short, so this only applies to a position you already hold.' });
  return { long, qty, notional, maxLoss, stopDistPct, flags, notionalPctOfEquity: (notional / equity) * 100 };
}

const STABLES = new Set(['USDC', 'USDT', 'DAI', 'vUSDC', 'vUSDT']);
export type Holding = { coin: string; usd: number };

export function portfolioHealth(h: Holding[]) {
  const rows = h.filter((x) => x.usd > 0.01).sort((a, b) => b.usd - a.usd);
  const total = rows.reduce((s, x) => s + x.usd, 0);
  if (!total) return null;
  const weights = rows.map((x) => ({ ...x, pct: (x.usd / total) * 100 }));
  const stablePct = weights.filter((x) => STABLES.has(x.coin)).reduce((s, x) => s + x.pct, 0);
  const risky = weights.filter((x) => !STABLES.has(x.coin));
  const topRisky = risky[0];
  const hhi = weights.reduce((s, x) => s + (x.pct / 100) ** 2, 0);
  const flags: Flag[] = [];
  if (topRisky && topRisky.pct > 50) flags.push({ sev: 'warn', text: `${topRisky.coin} is ${topRisky.pct.toFixed(0)}% of your portfolio. One bad move there hits everything.` });
  if (stablePct < 10 && risky.length) flags.push({ sev: 'info', text: `Only ${stablePct.toFixed(0)}% is in stablecoins, so you have little dry powder and no cushion.` });
  if (risky.length === 1 && stablePct < 50) flags.push({ sev: 'warn', text: 'Almost everything is in a single volatile asset.' });
  if (!flags.length) flags.push({ sev: 'info', text: 'No concentration warnings.' });
  const grade: Grade = flags.some((f) => f.sev === 'bad') ? 'avoid' : flags.some((f) => f.sev === 'warn') ? 'caution' : 'safe';
  return { total, weights, stablePct, hhi, flags, grade };
}

/* ───────── Trade journal: realised P&L (FIFO) from your own fills, only over the fills passed in ───────── */
export type JFill = { symbol: string; side: string; price: number; qty: number; fee: number; feeCoin: string; time: number; maker: boolean };

export function journalStats(fills: JFill[], quoteCoins: string[]) {
  const q = new Set(quoteCoins);
  const sorted = [...fills].sort((a, b) => a.time - b.time);
  const lots: Record<string, { qty: number; unit: number }[]> = {};
  const per: Record<string, { vol: number; fees: number; pnl: number; trades: number; unmatched: number }> = {};
  let vol = 0, fees = 0, pnl = 0, wins = 0, losses = 0, makers = 0;
  for (const f of sorted) {
    if (!(f.price > 0 && f.qty > 0)) continue;
    const p = (per[f.symbol] ??= { vol: 0, fees: 0, pnl: 0, trades: 0, unmatched: 0 });
    const notional = f.price * f.qty;
    const feeUsd = q.has(f.feeCoin) ? f.fee : f.fee * f.price; // fee in quote, else assume fee in the traded base coin
    vol += notional; fees += feeUsd; p.vol += notional; p.fees += feeUsd; p.trades++; if (f.maker) makers++;
    const book = (lots[f.symbol] ??= []);
    if (f.side.toLowerCase().startsWith('b') || f.side === '1') {
      book.push({ qty: f.qty, unit: (notional + feeUsd) / f.qty });
    } else {
      let left = f.qty, cost = 0, matched = 0;
      while (left > 1e-12 && book.length) {
        const l = book[0]; const t = Math.min(l.qty, left);
        cost += t * l.unit; matched += t; l.qty -= t; left -= t; if (l.qty <= 1e-12) book.shift();
      }
      p.unmatched += left;
      if (matched > 0) {
        const proceeds = (matched / f.qty) * (notional - feeUsd);
        const r = proceeds - cost; pnl += r; p.pnl += r; if (r >= 0) wins++; else losses++;
      }
    }
  }
  const rows = Object.entries(per).map(([symbol, v]) => ({ symbol, ...v })).sort((a, b) => b.vol - a.vol);
  return { trades: sorted.length, vol, fees, pnl, wins, losses, makerPct: sorted.length ? (makers / sorted.length) * 100 : 0, rows };
}
