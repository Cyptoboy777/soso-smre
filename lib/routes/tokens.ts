/** Verified token addresses used as quote origins and SoDEX EVM destinations.
 *  Native EVM tokens use the zero address (Relay and LI.FI convention).
 *  USDC addresses are the official Circle (or already-used Binance-peg on BNB Chain) contracts
 *  already referenced in this app for Ethereum and BNB Chain.
 */
export const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export type TokenRef = { symbol: string; chain: string; chainId: number; address: string; decimals: number; native?: boolean };

export const ROUTE_TOKENS: TokenRef[] = [
  { symbol: 'ETH', chain: 'ETH', chainId: 1, address: NATIVE_ADDRESS, decimals: 18, native: true },
  { symbol: 'ETH', chain: 'BASE', chainId: 8453, address: NATIVE_ADDRESS, decimals: 18, native: true },
  { symbol: 'ETH', chain: 'ARBITRUM', chainId: 42161, address: NATIVE_ADDRESS, decimals: 18, native: true },
  { symbol: 'BNB', chain: 'BSC_BNB', chainId: 56, address: NATIVE_ADDRESS, decimals: 18, native: true },
  { symbol: 'POL', chain: 'MATIC', chainId: 137, address: NATIVE_ADDRESS, decimals: 18, native: true },
  { symbol: 'MATIC', chain: 'MATIC', chainId: 137, address: NATIVE_ADDRESS, decimals: 18, native: true },
  { symbol: 'USDC', chain: 'ETH', chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDC', chain: 'BASE', chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { symbol: 'USDC', chain: 'ARBITRUM', chainId: 42161, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  { symbol: 'USDC', chain: 'BSC_BNB', chainId: 56, address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  { symbol: 'USDC', chain: 'MATIC', chainId: 137, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  { symbol: 'USDT', chain: 'ETH', chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'USDT', chain: 'ARBITRUM', chainId: 42161, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
  { symbol: 'USDT', chain: 'BSC_BNB', chainId: 56, address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
];

export function findRouteToken(symbol: string, chainOrId: string | number): TokenRef | undefined {
  if (typeof chainOrId === 'number') {
    return ROUTE_TOKENS.find((t) => t.symbol === symbol && t.chainId === chainOrId);
  }
  return ROUTE_TOKENS.find((t) => t.symbol === symbol && t.chain === chainOrId);
}

export function tokenByAddress(chainId: number, address: string): TokenRef | undefined {
  const a = address.toLowerCase();
  return ROUTE_TOKENS.find((t) => t.chainId === chainId && t.address.toLowerCase() === a);
}

export const QUOTE_CHAIN_IDS = [1, 8453, 42161, 56, 137] as const;

export function isQuoteChainId(id: number): boolean {
  return (QUOTE_CHAIN_IDS as readonly number[]).includes(id);
}

export const CHAIN_META: Record<number, { name: string; sodex: string; explorer: string; native: string; add?: { chainName: string; rpcUrls: string[]; nativeCurrency: { name: string; symbol: string; decimals: number }; blockExplorerUrls: string[] } }> = {
  1: { name: 'Ethereum', sodex: 'ETH', explorer: 'https://etherscan.io', native: 'ETH' },
  8453: {
    name: 'Base', sodex: 'BASE', explorer: 'https://basescan.org', native: 'ETH',
    add: { chainName: 'Base', rpcUrls: ['https://mainnet.base.org'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://basescan.org'] },
  },
  42161: {
    name: 'Arbitrum', sodex: 'ARBITRUM', explorer: 'https://arbiscan.io', native: 'ETH',
    add: { chainName: 'Arbitrum One', rpcUrls: ['https://arb1.arbitrum.io/rpc'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://arbiscan.io'] },
  },
  56: {
    name: 'BNB Chain', sodex: 'BSC_BNB', explorer: 'https://bscscan.com', native: 'BNB',
    add: { chainName: 'BNB Smart Chain', rpcUrls: ['https://bsc-dataseed.binance.org'], nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, blockExplorerUrls: ['https://bscscan.com'] },
  },
  137: {
    name: 'Polygon', sodex: 'MATIC', explorer: 'https://polygonscan.com', native: 'POL',
    add: { chainName: 'Polygon', rpcUrls: ['https://polygon-rpc.com'], nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 }, blockExplorerUrls: ['https://polygonscan.com'] },
  },
};

export function explorerTx(chainId: number, hash: string): string {
  const base = CHAIN_META[chainId]?.explorer;
  return base ? `${base}/tx/${hash}` : hash;
}

export function explorerAddress(chainId: number, address: string): string {
  const base = CHAIN_META[chainId]?.explorer;
  return base ? `${base}/address/${address}` : address;
}
