/** Turns a spoken or typed swap request into form values. Pure text parsing: it never trades, it only says what to fill in. */

export type SwapCommand = { from: string; to: string; amount: string };

const NUM_WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
const ALIAS: Record<string, string> = { USD: 'USDC', USDT: 'USDC', DOLLAR: 'USDC', DOLLARS: 'USDC', BUCKS: 'USDC', BITCOIN: 'BTC', ETHER: 'ETH', ETHEREUM: 'ETH', SOLANA: 'SOL' };
const sym = (w: string) => { const u = w.replace(/[^a-z0-9]/gi, '').toUpperCase(); return ALIAS[u] ?? u; };
const isSym = (u: string) => /^[A-Z][A-Z0-9]{1,9}$/.test(u);

function amountOf(t: string): string | null {
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  if (m) { const n = parseFloat(m[1].replace(',', '.')); return n > 0 ? String(n) : null; }
  const w = t.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred)\b/i);
  return w && NUM_WORDS[w[1].toLowerCase()] > 0 ? String(NUM_WORDS[w[1].toLowerCase()]) : null;
}

/** Examples: "swap 10 USDC to ETH", "convert 0.5 ETH into USDC", "buy 50 dollars of BTC", "sell 0.1 BTC", "buy BTC with 100 USDC". */
export function parseSwapCommand(input: string): SwapCommand | null {
  const t = input.trim().replace(/\s+/g, ' ');
  if (t.length > 120) return null;
  const NUM = '(\\d+(?:[.,]\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred)';
  const W = '([a-z][a-z0-9]*)';
  let m = t.match(new RegExp(`^(?:please |can you |i want to |i wanna )?(?:swap|convert|exchange|trade|change)\\s+${NUM}\\s+${W}\\s+(?:to|for|into)\\s+${W}\\s*\\.?$`, 'i'));
  if (m) { const a = amountOf(m[1]); const f = sym(m[2]), to = sym(m[3]); return a && isSym(f) && isSym(to) && f !== to ? { from: f, to, amount: a } : null; }
  m = t.match(new RegExp(`^(?:please |can you |i want to |i wanna )?buy\\s+${W}\\s+(?:with|using)\\s+${NUM}\\s+${W}\\s*\\.?$`, 'i'));
  if (m) { const a = amountOf(m[2]); const to = sym(m[1]), f = sym(m[3]); return a && isSym(f) && isSym(to) && f !== to ? { from: f, to, amount: a } : null; }
  m = t.match(new RegExp(`^(?:please |can you |i want to |i wanna )?buy\\s+${NUM}\\s+(?:(?:usd|usdc|usdt|dollars?|bucks)\\s+(?:worth\\s+)?(?:of|in)\\s+)?${W}\\s*\\.?$`, 'i'));
  if (m) { const a = amountOf(m[1]); const to = sym(m[2]); return a && isSym(to) && to !== 'USDC' ? { from: 'USDC', to, amount: a } : null; }
  m = t.match(new RegExp(`^(?:please |can you |i want to |i wanna )?sell\\s+${NUM}\\s+${W}\\s*\\.?$`, 'i'));
  if (m) { const a = amountOf(m[1]); const f = sym(m[2]); return a && isSym(f) && f !== 'USDC' ? { from: f, to: 'USDC', amount: a } : null; }
  return null;
}
