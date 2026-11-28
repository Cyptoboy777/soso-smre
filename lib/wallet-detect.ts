/** Finds browser wallets. EIP-6963 announcements come first; older extensions that only set window.ethereum are found through flags and known globals. */

export type DetectedWallet = { id: string; name: string; icon?: string; provider: any };

const hasRequest = (p: any) => !!p && typeof p.request === 'function';

/** Name a legacy provider from the flags wallets set on it. Order matters: many wallets also set isMetaMask. */
export function nameFromFlags(p: any): { kind: string; name: string } {
  if (p?.isRabby) return { kind: 'rabby', name: 'Rabby' };
  if (p?.isBraveWallet) return { kind: 'brave', name: 'Brave Wallet' };
  if (p?.isCoinbaseWallet || p?.isCoinbaseBrowser) return { kind: 'coinbase', name: 'Coinbase Wallet' };
  if (p?.isOkxWallet || p?.isOKExWallet) return { kind: 'okx', name: 'OKX Wallet' };
  if (p?.isTrust || p?.isTrustWallet) return { kind: 'trust', name: 'Trust Wallet' };
  if (p?.isPhantom) return { kind: 'phantom', name: 'Phantom' };
  if (p?.isBitKeep || p?.isBitget) return { kind: 'bitget', name: 'Bitget Wallet' };
  if (p?.isRainbow) return { kind: 'rainbow', name: 'Rainbow' };
  if (p?.isMetaMask) return { kind: 'metamask', name: 'MetaMask' };
  return { kind: 'injected', name: 'Browser wallet' };
}

/** Providers that did not announce through EIP-6963. Duplicates of the same provider object are removed. */
export function legacyWallets(win: any): DetectedWallet[] {
  const out: DetectedWallet[] = [];
  const seen = new Set<any>();
  const add = (p: any, forced?: { kind: string; name: string }) => {
    if (!hasRequest(p) || seen.has(p)) return;
    seen.add(p);
    const n = forced ?? nameFromFlags(p);
    out.push({ id: `legacy.${n.kind}`, name: n.name, provider: p });
  };
  const eth = win?.ethereum;
  if (Array.isArray(eth?.providers)) eth.providers.forEach((p: any) => add(p));
  add(eth);
  add(win?.okxwallet, { kind: 'okx', name: 'OKX Wallet' });
  add(win?.phantom?.ethereum, { kind: 'phantom', name: 'Phantom' });
  add(win?.coinbaseWalletExtension, { kind: 'coinbase', name: 'Coinbase Wallet' });
  add(win?.trustwallet, { kind: 'trust', name: 'Trust Wallet' });
  add(win?.rabby, { kind: 'rabby', name: 'Rabby' });
  add(win?.bitkeep?.ethereum, { kind: 'bitget', name: 'Bitget Wallet' });
  // two entries of the same kind (e.g. a wallet that exposes itself twice) collapse into one
  const kinds = new Set<string>();
  return out.filter((w) => (kinds.has(w.id) ? false : (kinds.add(w.id), true)));
}

const kindOf = (w: { id: string; name: string }) => {
  const s = `${w.id} ${w.name}`.toLowerCase();
  for (const k of ['metamask', 'rabby', 'coinbase', 'okx', 'okex', 'trust', 'rainbow', 'brave', 'bitget', 'bitkeep', 'phantom']) if (s.includes(k)) return k === 'okex' ? 'okx' : k === 'bitkeep' ? 'bitget' : k;
  return null;
};

/** Announced wallets plus any legacy ones that are not already listed. The last used wallet goes first. */
export function mergeWallets(announced: DetectedWallet[], legacy: DetectedWallet[], lastId?: string | null): DetectedWallet[] {
  const list = [...announced];
  const kinds = new Set(announced.map(kindOf).filter(Boolean));
  const provs = new Set(announced.map((w) => w.provider));
  for (const w of legacy) {
    const k = kindOf(w);
    if (provs.has(w.provider) || (k && kinds.has(k))) continue;
    // a generic "Browser wallet" is only useful when nothing else was found
    if (!k && list.length) continue;
    list.push(w);
    if (k) kinds.add(k);
  }
  const lastKind = lastId ? kindOf({ id: lastId, name: lastId }) : null;
  const isLast = (w: DetectedWallet) => !!lastId && (w.id === lastId || (!!lastKind && kindOf(w) === lastKind));
  return list.map((w, i) => ({ w, i })).sort((a, b) => Number(isLast(b.w)) - Number(isLast(a.w)) || a.i - b.i).map((x) => x.w);
}

export const sameWallet = (id: string | null | undefined, w: { id: string; name: string }) => {
  if (!id) return false;
  if (w.id === id) return true;
  const a = kindOf({ id, name: id }), b = kindOf(w);
  return !!a && a === b;
};
