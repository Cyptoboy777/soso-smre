/**
 * Plain-language thesis helpers: flow wording, headline clean-up, short copy.
 */

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/** Inflow when >= 0, outflow when < 0. */
export function flowDirectionWord(netUsd: number): 'inflow' | 'outflow' {
  return netUsd >= 0 ? 'inflow' : 'outflow';
}

export function formatFlowUsd(netUsd: number): string {
  return `$${Math.abs(netUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** "BTC US ETF net outflow of $201M" style. */
export function describeEtfFlow(netUsd: number | null | undefined, asset: string): string {
  if (netUsd == null || !Number.isFinite(netUsd)) return `${asset} ETF flow unavailable`;
  return `${asset} US ETF net ${flowDirectionWord(netUsd)} of ${formatFlowUsd(netUsd)}`;
}

/**
 * Fix contradictory "negative … inflows" / "positive … outflows" phrasing.
 * Also normalizes signed amount wording.
 */
export function correctFlowWording(text: string): string {
  let out = text;
  // Common Gemini slips first (exact-ish phrases)
  out = out.replace(/\bnegative\s+ETF\s+net\s+inflows?\b/gi, 'ETF net outflows');
  out = out.replace(/\bnegative\s+net\s+inflows?\b/gi, 'net outflows');
  out = out.replace(/\bpositive\s+ETF\s+net\s+outflows?\b/gi, 'ETF net inflows');
  out = out.replace(/\bpositive\s+net\s+outflows?\b/gi, 'net inflows');
  out = out.replace(/\bnegative\s+((?:[A-Za-z]+\s+){0,3})(?:ETF\s+)?net\s+inflows?\b/gi, (_m, pref: string) => {
    const p = String(pref || '').trim();
    return p ? `net ${p} outflows`.replace(/\s+/g, ' ') : 'net outflows';
  });
  out = out.replace(/\bnegative\s+((?:[A-Za-z]+\s+){0,3})(?:ETF\s+)?net\s+inflow\b/gi, (_m, pref: string) => {
    const p = String(pref || '').trim();
    return p ? `net ${p} outflow`.replace(/\s+/g, ' ') : 'net outflow';
  });
  // "inflows of -$201M" -> "outflow of $201M"
  out = out.replace(
    /\b(net\s+)?inflows?\s+of\s+-\$?([\d,.]+)\s*(M|B|K)?\b/gi,
    (_m, _net, num, unit) => `net outflow of $${num}${unit ?? ''}`,
  );
  out = out.replace(
    /\b(net\s+)?outflows?\s+of\s+\+?\$?([\d,.]+)\s*(M|B|K)?\b/gi,
    (_m, _net, num, unit) => `net outflow of $${num}${unit ?? ''}`,
  );
  return out;
}

/** Strip truncated / broken headline fragments. */
export function sanitizeHeadline(raw: string): string {
  let t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  // Drop dangling "viewing it as ;" / "as ;" / trailing semicolon clauses
  t = t.replace(/,?\s*viewing it as\s*;?\s*$/i, '');
  t = t.replace(/\bas\s*;+\s*$/i, '');
  t = t.replace(/[;,:]\s*$/g, '');
  t = t.replace(/\s+[—–-]\s*$/g, '');
  // If truncated mid-phrase with trailing "..." keep clean ellipsis
  t = t.replace(/\.{4,}/g, '...');
  // Remove raw numeric news ids
  t = t.replace(/\[\d{6,}\]/g, '').trim();
  // Cap length at word boundary
  const max = 72;
  if (t.length > max) {
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    t = (sp > 40 ? cut.slice(0, sp) : cut).trim();
    if (!/[.!?…]$/.test(t)) t = `${t}…`;
  }
  return t;
}

export function pickNewsChips(
  headlines: string[] | undefined,
  newsItems: { title: string; url?: string }[] | undefined,
  limit = 3,
): { title: string; url?: string }[] {
  const titles = (headlines ?? [])
    .map(sanitizeHeadline)
    .filter((t) => t.length >= 8);
  const uniq: string[] = [];
  for (const t of titles) {
    const key = t.toLowerCase();
    if (uniq.some((u) => u.toLowerCase() === key || u.toLowerCase().includes(key) || key.includes(u.toLowerCase()))) {
      continue;
    }
    uniq.push(t);
    if (uniq.length >= limit) break;
  }
  return uniq.map((title) => {
    const hit = (newsItems ?? []).find((n) => {
      const st = sanitizeHeadline(n.title);
      return st === title || n.title.includes(title.slice(0, 24)) || title.includes(sanitizeHeadline(n.title).slice(0, 24));
    });
    return { title, url: hit?.url && hit.url !== '#' ? hit.url : undefined };
  });
}

const INTERNAL_PHRASES = [
  /\bwe remain flat on the desk(?:\s+today)?\b/gi,
  /\bremain flat on the desk(?:\s+today)?\b/gi,
  /\bon the desk today\b/gi,
  /\bno trade setup\.?/gi,
  /\blevels stay hidden\b[^.?!]*[.?!]?/gi,
  /\bvalid directional idea\b[^.?!]*[.?!]?/gi,
  /\bRelated:\s*[^.?!]*(?:[.?!]|$)/gi,
];

/** Max ~2 short sentences, plain words, no duplicated Related news. */
export function normalizeThesisPlain(raw: string, opts?: { maxSentences?: number }): string {
  let text = String(raw ?? '');
  text = text.replace(/\[\d{6,}\]/g, '');
  text = text.replace(/\s*Related:\s*[\s\S]*$/i, '');
  for (const re of INTERNAL_PHRASES) text = text.replace(re, ' ');
  text = correctFlowWording(text);
  // Clean broken fragments left by model
  text = text.replace(/,?\s*viewing it as\s*;?/gi, '');
  text = text.replace(/\bas\s*;+/gi, '');
  text = text.replace(/\s{2,}/g, ' ').trim();
  text = text.replace(/\s+([,.;!?])/g, '$1');
  text = text.replace(/([,;]){2,}/g, '$1');

  const maxSentences = opts?.maxSentences ?? 2;
  // Preserve a short flow clause before we shorten run-ons
  const flowClause =
    text.match(/\b(?:BTC|ETH|ETF)[^.]{0,40}\bnet\s+(?:inflow|outflow)s?\b[^.]{0,40}/i)?.[0] ??
    text.match(/\bnet\s+(?:inflow|outflow)s?\b[^.]{0,40}/i)?.[0] ??
    '';

  const parts = text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length > 3);

  const shorten = (s: string): string => {
    let x = s;
    if (!/[.!?]$/.test(x)) x = `${x}.`;
    if (x.length <= 140) return x;
    // Prefer a readable head clause
    const alongside = x.split(/\balongside\b/i)[0]?.trim() ?? x;
    let cut = alongside.length > 20 && alongside.length < x.length ? alongside : x;
    if (cut.length > 140) {
      const slice = cut.slice(0, 130);
      const sp = slice.lastIndexOf(' ');
      cut = (sp > 50 ? slice.slice(0, sp) : slice).trim();
    }
    cut = cut.replace(/[,:;\-–—]\s*$/g, '').trim();
    if (!/[.!?]$/.test(cut)) cut = `${cut}.`;
    return cut;
  };

  let kept = parts.slice(0, maxSentences).map(shorten);
  const joined = kept.join(' ');
  if (flowClause && !/net\s+(?:inflow|outflow)/i.test(joined)) {
    const extra = flowClause.replace(/\s+/g, ' ').trim().replace(/[,:;]\s*$/g, '');
    const flowSentence = /[.!?]$/.test(extra) ? extra : `${extra}.`;
    if (kept.length < maxSentences) kept = [...kept, flowSentence];
    else kept = [kept[0], flowSentence];
  }
  return kept.join(' ').trim();
}

export function buildShortRulePlain(opts: {
  side: 'LONG' | 'SHORT' | 'FLAT';
  symbol: string;
  btcFlow: number | null;
  ethFlow: number | null;
  newsShock?: boolean;
}): string {
  const pair = opts.symbol.replace(/v/g, '').replace('_', '/');
  const leadFlow = describeEtfFlow(opts.btcFlow, 'BTC');
  if (opts.side === 'FLAT') {
    const why = opts.newsShock
      ? `${leadFlow} and news risk is elevated, so conviction is too weak for a clear move.`
      : `${leadFlow}, so conviction is too weak for a clear move.`;
    return `Stand aside for now. ${why}`;
  }
  if (opts.side === 'LONG') {
    return `Lean bullish on ${pair}. ${leadFlow}, which supports a buy plan.`;
  }
  return `Lean bearish on ${pair}. ${leadFlow}, which supports a sell plan.`;
}
