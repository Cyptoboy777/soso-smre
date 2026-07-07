/**
 * Universal Multi-Wallet Connector
 * Detects and connects to ANY EVM-compatible browser extension wallet
 * (MetaMask, Rabby, Coinbase, Trust, OKX, Phantom EVM, Brave, etc.)
 */

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;         // emoji or URL
  provider: any;        // the raw EIP-1193 provider
  isInstalled: boolean;
}

/** Inspect window for all known EVM providers */
export function detectWallets(): WalletProvider[] {
  if (typeof window === 'undefined') return [];

  const w = window as any;
  const found: WalletProvider[] = [];

  // ── EIP-6963 multi-provider standard (newest wallets) ────────────────────
  // Wallets that follow EIP-6963 self-announce via window.ethereum.providers
  const providers: any[] = w.ethereum?.providers ?? [];

  // Helper: push a detected wallet if its provider object exists
  const push = (id: string, name: string, icon: string, provider: any) => {
    if (provider && !found.find(f => f.id === id)) {
      found.push({ id, name, icon, provider, isInstalled: true });
    }
  };

  // ── Detect via providers array (EIP-6963 / multi-injection) ──────────────
  if (providers.length > 0) {
    for (const p of providers) {
      if (p.isMetaMask && !p.isRabby) push('metamask', 'MetaMask', '🦊', p);
      if (p.isRabby)                  push('rabby',    'Rabby',    '🐰', p);
      if (p.isCoinbaseWallet)         push('coinbase',  'Coinbase Wallet', '🔵', p);
      if (p.isTrust)                  push('trust',    'Trust Wallet', '🛡️', p);
      if (p.isOKExWallet || p.isOkxWallet) push('okx', 'OKX Wallet', '⭕', p);
      if (p.isBraveWallet)            push('brave',    'Brave Wallet', '🦁', p);
    }
  }

  // ── Detect via individual window properties ───────────────────────────────
  if (w.ethereum) {
    const e = w.ethereum;
    if (e.isMetaMask && !e.isRabby && !found.find(f => f.id === 'metamask'))
      push('metamask',  'MetaMask',       '🦊', e);
    if (e.isRabby && !found.find(f => f.id === 'rabby'))
      push('rabby',     'Rabby',          '🐰', e);
    if (e.isCoinbaseWallet && !found.find(f => f.id === 'coinbase'))
      push('coinbase',  'Coinbase Wallet','🔵', e);
    if (e.isTrust && !found.find(f => f.id === 'trust'))
      push('trust',     'Trust Wallet',   '🛡️', e);
    if ((e.isOKExWallet || e.isOkxWallet) && !found.find(f => f.id === 'okx'))
      push('okx',       'OKX Wallet',     '⭕', e);
    if (e.isBraveWallet && !found.find(f => f.id === 'brave'))
      push('brave',     'Brave Wallet',   '🦁', e);
    if (!e.isMetaMask && !e.isRabby && !e.isCoinbaseWallet && !e.isTrust && !e.isOKExWallet && !e.isBraveWallet)
      push('injected',  'Injected Wallet','💼', e);

    // Fallback: if window.ethereum exists but none of the above matched, add it as "Injected"
    if (found.length === 0) {
      push('injected', 'Browser Wallet', '💼', e);
    }
  }

  // ── Phantom (EVM mode) ────────────────────────────────────────────────────
  if (w.phantom?.ethereum) push('phantom', 'Phantom', '👻', w.phantom.ethereum);

  return found;
}

/** Request accounts from a specific EIP-1193 provider */
export async function connectToWallet(provider: any): Promise<string> {
  const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts.length) throw new Error('No accounts returned');
  return accounts[0];
}

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthProof {
  address: string;
  message: string;
  signature: string;
  timestamp: number;
}

function buildAuthMessage(address: string, ts: number): string {
  return `Welcome to SoSo SMRE!\n\nSign to authenticate your wallet — no funds will move.\nAddress: ${address}\nTimestamp: ${ts}`;
}

/** Sign a SIWE-style message for authentication proof */
export async function signAuthMessage(provider: any, address: string): Promise<AuthProof> {
  const ts      = Date.now();
  const message = buildAuthMessage(address, ts);
  const hexMsg  = '0x' + Buffer.from(message, 'utf8').toString('hex');
  const signature: string = await provider.request({
    method: 'personal_sign',
    params: [hexMsg, address],
  });
  return { address, message, signature, timestamp: ts };
}

/**
 * Verify a wallet's signature over its auth message. Without this, "login" was just
 * whatever address the client claimed — anyone could spoof a session by setting
 * localStorage directly. Also rejects stale/expired sessions.
 */
export async function verifyAuthProof(proof: AuthProof): Promise<boolean> {
  if (!proof?.address || !proof.message || !proof.signature || !proof.timestamp) return false;
  if (Date.now() - proof.timestamp > SESSION_MAX_AGE_MS) return false;
  if (proof.message !== buildAuthMessage(proof.address, proof.timestamp)) return false;

  try {
    const { verifyMessage } = await import('viem');
    return await verifyMessage({
      address: proof.address as `0x${string}`,
      message: proof.message,
      signature: proof.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

/** Get current chain ID */
export async function getChainId(provider: any): Promise<number> {
  const hex: string = await provider.request({ method: 'eth_chainId' });
  return parseInt(hex, 16);
}
