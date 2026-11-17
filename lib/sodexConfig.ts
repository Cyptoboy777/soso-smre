/** SoDEX deposit and withdrawal configuration, copied from the official table.
 *  Source (re-fetched 2026-11-17):
 *  https://docs.sodex.com/user-guide/deposit-and-withdrawal-guidance/deposit-and-withdrawal-configuration
 *  Units are token units as listed by SoDEX (the page does not state a unit name). Label them "per SoDEX docs".
 */
export type SodexAsset = {
  token: string;
  chain: string;
  withdrawFee: number;
  bridgeWithdrawFee: number;
  minDeposit: number;
  minWithdraw: number;
};

export const SODEX_CONFIG_SOURCE =
  'https://docs.sodex.com/user-guide/deposit-and-withdrawal-guidance/deposit-and-withdrawal-configuration';
export const SODEX_DEPOSIT_GUIDE =
  'https://docs.sodex.com/user-guide/deposit-and-withdrawal-guidance';
export const SODEX_SITE = 'https://sodex.com';

export const SODEX_ASSETS: SodexAsset[] = [
  { token: 'AAVE', chain: 'ETH', withdrawFee: 0.015, bridgeWithdrawFee: 0, minDeposit: 0.01, minWithdraw: 0.015 },
  { token: 'AAPL', chain: 'SOL', withdrawFee: 0.004, bridgeWithdrawFee: 0, minDeposit: 0.0185, minWithdraw: 0.01 },
  { token: 'ADA', chain: 'ADA', withdrawFee: 4, bridgeWithdrawFee: 0, minDeposit: 10, minWithdraw: 10 },
  { token: 'AMZN', chain: 'SOL', withdrawFee: 0.0035, bridgeWithdrawFee: 0, minDeposit: 0.016, minWithdraw: 0.0065 },
  { token: 'ARB', chain: 'ARBITRUM', withdrawFee: 10, bridgeWithdrawFee: 0, minDeposit: 25, minWithdraw: 25 },
  { token: 'AVAX', chain: 'AVAXC', withdrawFee: 0.12, bridgeWithdrawFee: 0, minDeposit: 0.35, minWithdraw: 0.35 },
  { token: 'BNB', chain: 'BSC_BNB', withdrawFee: 0.002, bridgeWithdrawFee: 0, minDeposit: 0.005, minWithdraw: 0.002 },
  { token: 'BTC', chain: 'BTC', withdrawFee: 0.00006, bridgeWithdrawFee: 0, minDeposit: 0.00005, minWithdraw: 0.0005 },
  { token: 'CRCL', chain: 'SOL', withdrawFee: 0.01, bridgeWithdrawFee: 0, minDeposit: 0.01, minWithdraw: 0.01 },
  { token: 'DEFI.ssi', chain: 'BASE', withdrawFee: 0, bridgeWithdrawFee: 4, minDeposit: 20, minWithdraw: 10 },
  { token: 'DOGE', chain: 'DOGE', withdrawFee: 12, bridgeWithdrawFee: 0, minDeposit: 30, minWithdraw: 30 },
  { token: 'ETH', chain: 'ARBITRUM', withdrawFee: 0.0005, bridgeWithdrawFee: 0, minDeposit: 0.0015, minWithdraw: 0.0015 },
  { token: 'ETH', chain: 'BASE', withdrawFee: 0.0005, bridgeWithdrawFee: 0, minDeposit: 0.002, minWithdraw: 0.0005 },
  { token: 'ETH', chain: 'ETH', withdrawFee: 0.0005, bridgeWithdrawFee: 0, minDeposit: 0.002, minWithdraw: 0.002 },
  { token: 'GOOGL', chain: 'SOL', withdrawFee: 0.0035, bridgeWithdrawFee: 0, minDeposit: 0.016, minWithdraw: 0.0065 },
  { token: 'HYPE', chain: 'HYPEREVM', withdrawFee: 0.03, bridgeWithdrawFee: 0, minDeposit: 0.1, minWithdraw: 0.1 },
  { token: 'LINK', chain: 'ETH', withdrawFee: 0.12, bridgeWithdrawFee: 0, minDeposit: 0.5, minWithdraw: 0.5 },
  { token: 'LTC', chain: 'LTC', withdrawFee: 0.02, bridgeWithdrawFee: 0, minDeposit: 0.05, minWithdraw: 0.05 },
  { token: 'MAG7.ssi', chain: 'BASE', withdrawFee: 0, bridgeWithdrawFee: 1, minDeposit: 5, minWithdraw: 1 },
  { token: 'MEME.ssi', chain: 'BASE', withdrawFee: 0, bridgeWithdrawFee: 4, minDeposit: 20, minWithdraw: 20 },
  { token: 'META', chain: 'SOL', withdrawFee: 0.002, bridgeWithdrawFee: 0, minDeposit: 0.008, minWithdraw: 0.003 },
  { token: 'MSFT', chain: 'SOL', withdrawFee: 0.0025, bridgeWithdrawFee: 0, minDeposit: 0.0125, minWithdraw: 0.005 },
  { token: 'NVDA', chain: 'SOL', withdrawFee: 0.005, bridgeWithdrawFee: 0, minDeposit: 0.03, minWithdraw: 0.01 },
  { token: 'PEPE', chain: 'ETH', withdrawFee: 340000, bridgeWithdrawFee: 0, minDeposit: 750000, minWithdraw: 750000 },
  { token: 'SHIB', chain: 'ETH', withdrawFee: 250000, bridgeWithdrawFee: 0, minDeposit: 500000, minWithdraw: 500000 },
  { token: 'SOL', chain: 'SOL', withdrawFee: 0.012, bridgeWithdrawFee: 0, minDeposit: 0.03, minWithdraw: 0.012 },
  { token: 'SUI', chain: 'SUI', withdrawFee: 1.1, bridgeWithdrawFee: 0, minDeposit: 2, minWithdraw: 2 },
  { token: 'TON', chain: 'TON', withdrawFee: 0.8, bridgeWithdrawFee: 0, minDeposit: 3, minWithdraw: 3 },
  { token: 'TSLA', chain: 'SOL', withdrawFee: 0.0025, bridgeWithdrawFee: 0, minDeposit: 0.0125, minWithdraw: 0.005 },
  { token: 'UNI', chain: 'ETH', withdrawFee: 0.5, bridgeWithdrawFee: 0, minDeposit: 1, minWithdraw: 1 },
  { token: 'USDC', chain: 'ARBITRUM', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 5 },
  { token: 'USDC', chain: 'BASE', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 5 },
  { token: 'USDC', chain: 'BSC_BNB', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 5 },
  { token: 'USDC', chain: 'ETH', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 5 },
  { token: 'USDC', chain: 'MATIC', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 2 },
  { token: 'USDC', chain: 'SOL', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 5 },
  { token: 'USDT', chain: 'ARBITRUM', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 2 },
  { token: 'USDT', chain: 'BSC_BNB', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 2 },
  { token: 'USDT', chain: 'ETH', withdrawFee: 1.5, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 2 },
  { token: 'USDT', chain: 'SOL', withdrawFee: 1, bridgeWithdrawFee: 0, minDeposit: 5, minWithdraw: 2 },
  { token: 'USSI', chain: 'BASE', withdrawFee: 0, bridgeWithdrawFee: 1, minDeposit: 5, minWithdraw: 2 },
  { token: 'XAUt', chain: 'ETH', withdrawFee: 0.0002, bridgeWithdrawFee: 0, minDeposit: 0.002, minWithdraw: 0.002 },
  { token: 'XLM', chain: 'XLM', withdrawFee: 7, bridgeWithdrawFee: 0, minDeposit: 25, minWithdraw: 25 },
  { token: 'XRP', chain: 'XRP', withdrawFee: 0.8, bridgeWithdrawFee: 0, minDeposit: 3, minWithdraw: 2 },
  { token: 'ZEC', chain: 'ZEC', withdrawFee: 0, bridgeWithdrawFee: 0, minDeposit: 0.01, minWithdraw: 0.01 },
  { token: 'sMAG7.ssi', chain: 'BASE', withdrawFee: 0, bridgeWithdrawFee: 0.5, minDeposit: 5, minWithdraw: 1 },
];

/** EVM chain ids are the public network ids. Solana and Bitcoin ids are Relay's official assignments
 *  (https://docs.relay.link/references/api/api_guides/solana , https://docs.relay.link/references/api/api_guides/bitcoin).
 *  Other SoDEX chains have no verified quote-provider id here and stay null. */
export const SODEX_CHAIN_IDS: Record<string, number | null> = {
  ETH: 1,
  BASE: 8453,
  ARBITRUM: 42161,
  BSC_BNB: 56,
  MATIC: 137,
  SOL: 792703809,
  BTC: 8253038,
  ADA: null,
  AVAXC: null,
  DOGE: null,
  HYPEREVM: null,
  LTC: null,
  SUI: null,
  TON: null,
  XLM: null,
  XRP: null,
  ZEC: null,
};

export const EVM_SODEX_CHAINS = ['ETH', 'BASE', 'ARBITRUM', 'BSC_BNB', 'MATIC'] as const;
export type EvmSodexChain = (typeof EVM_SODEX_CHAINS)[number];

export const STABLECOINS = new Set(['USDC', 'USDT']);

export const CHAIN_LABEL: Record<string, string> = {
  ETH: 'Ethereum',
  BASE: 'Base',
  ARBITRUM: 'Arbitrum',
  BSC_BNB: 'BNB Chain',
  MATIC: 'Polygon',
  SOL: 'Solana',
  BTC: 'Bitcoin',
  ADA: 'Cardano',
  AVAXC: 'Avalanche',
  DOGE: 'Dogecoin',
  HYPEREVM: 'HyperEVM',
  LTC: 'Litecoin',
  SUI: 'Sui',
  TON: 'TON',
  XLM: 'Stellar',
  XRP: 'XRP',
  ZEC: 'Zcash',
};

export function isEvmSodexChain(chain: string): chain is EvmSodexChain {
  return (EVM_SODEX_CHAINS as readonly string[]).includes(chain);
}

export function findAsset(token: string, chain: string): SodexAsset | undefined {
  const t = token.trim();
  const c = chain.trim();
  return SODEX_ASSETS.find((a) => a.token === t && a.chain === c);
}

export function isAllowedDestination(token: string, chain: string): boolean {
  return !!findAsset(token, chain);
}

export function assetsForToken(token: string): SodexAsset[] {
  return SODEX_ASSETS.filter((a) => a.token === token);
}

export function totalWithdrawFee(a: SodexAsset): number {
  return a.withdrawFee + a.bridgeWithdrawFee;
}

/** Cheapest SoDEX withdrawal route for a token: lowest total fee, then lowest min withdrawal. */
export function cheapestWithdraw(token: string): SodexAsset | null {
  const rows = assetsForToken(token);
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const fee = totalWithdrawFee(a) - totalWithdrawFee(b);
    if (fee !== 0) return fee;
    return a.minWithdraw - b.minWithdraw;
  })[0];
}

export type DepositGate =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'below-min' | 'below-stable-usd'; message: string };

/** Client and server min-deposit gate. Stablecoins also need about $5 USD when a price is supplied. */
export function minDepositGate(opts: {
  token: string;
  chain: string;
  amount: number;
  usdApprox?: number | null;
}): DepositGate {
  const asset = findAsset(opts.token, opts.chain);
  if (!asset) {
    return { ok: false, reason: 'unsupported', message: 'SoDEX will not credit this. Choose a supported token and chain instead.' };
  }
  if (!(opts.amount > 0)) {
    return { ok: false, reason: 'below-min', message: `Enter at least ${asset.minDeposit} ${asset.token} (per SoDEX docs).` };
  }
  if (opts.amount < asset.minDeposit) {
    return { ok: false, reason: 'below-min', message: `That is below the ${asset.minDeposit} ${asset.token} minimum deposit on ${CHAIN_LABEL[asset.chain] ?? asset.chain} (per SoDEX docs).` };
  }
  if (STABLECOINS.has(asset.token) && opts.usdApprox != null && Number.isFinite(opts.usdApprox) && opts.usdApprox < 5) {
    return { ok: false, reason: 'below-stable-usd', message: 'SoDEX requires at least $5 per deposit for this token.' };
  }
  return { ok: true };
}

export type DestAdvice =
  | { kind: 'direct'; asset: SodexAsset }
  | { kind: 'route'; asset: SodexAsset; reason: string }
  | { kind: 'unsupported'; message: string; suggestion?: SodexAsset };

/** Pick the best SoDEX-supported destination for a source token and chain.
 *  When the wallet is an EVM address, only EVM SoDEX chains are chosen so funds can land in that same address.
 */
export function bestDestination(sourceToken: string, sourceChain: string, evmWallet = true): DestAdvice {
  const direct = findAsset(sourceToken, sourceChain);
  if (direct && (!evmWallet || isEvmSodexChain(direct.chain))) {
    return { kind: 'direct', asset: direct };
  }
  if (direct && evmWallet && !isEvmSodexChain(direct.chain)) {
    const evmSame = assetsForToken(sourceToken).filter((a) => isEvmSodexChain(a.chain));
    if (evmSame.length) {
      const asset = pickPreferred(evmSame);
      return {
        kind: 'route',
        asset,
        reason: `${sourceToken} can be deposited to SoDEX on ${CHAIN_LABEL[direct.chain] ?? direct.chain}, but this wallet is an Ethereum address and cannot receive funds there. ${asset.token} on ${CHAIN_LABEL[asset.chain]} will land in the same wallet.`,
      };
    }
  }
  const same = assetsForToken(sourceToken).filter((a) => !evmWallet || isEvmSodexChain(a.chain));
  if (same.length) {
    const asset = pickPreferred(same);
    return {
      kind: 'route',
      asset,
      reason: `SoDEX accepts ${asset.token} on ${CHAIN_LABEL[asset.chain] ?? asset.chain}.`,
    };
  }
  const usdc = assetsForToken('USDC').filter((a) => !evmWallet || isEvmSodexChain(a.chain));
  if (usdc.length) {
    const asset = pickPreferred(usdc);
    return {
      kind: 'route',
      asset,
      reason: `SoDEX does not list ${sourceToken} on ${CHAIN_LABEL[sourceChain] ?? sourceChain} as a deposit. USDC on ${CHAIN_LABEL[asset.chain]} is a supported destination that can land in this wallet.`,
    };
  }
  return { kind: 'unsupported', message: 'SoDEX will not credit this. Choose a supported token and chain instead.' };
}

function pickPreferred(rows: SodexAsset[]): SodexAsset {
  const base = rows.find((a) => a.chain === 'BASE');
  if (base) return base;
  return [...rows].sort((a, b) => a.minDeposit - b.minDeposit || totalWithdrawFee(a) - totalWithdrawFee(b))[0];
}

export function evmDestinationsFor(token?: string): SodexAsset[] {
  const rows = token ? assetsForToken(token) : SODEX_ASSETS;
  return rows.filter((a) => isEvmSodexChain(a.chain));
}

export function tokensWithWithdrawOptions(): string[] {
  return [...new Set(SODEX_ASSETS.map((a) => a.token))].sort((a, b) => a.localeCompare(b));
}

export function chainIdForSodex(chain: string, provider: 'relay' | 'lifi'): number | null {
  if (provider === 'lifi' && (chain === 'SOL' || chain === 'BTC')) return null; // no verified LI.FI id in this repo
  return SODEX_CHAIN_IDS[chain] ?? null;
}

export function sodexChainFromId(chainId: number): string | undefined {
  for (const [name, id] of Object.entries(SODEX_CHAIN_IDS)) {
    if (id === chainId) return name;
  }
  return undefined;
}
