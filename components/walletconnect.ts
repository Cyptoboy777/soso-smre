/* WalletConnect v2 (Reown) for phones and any wallet without a browser extension.
 * Loaded on demand (dynamic import) so it adds nothing to the first page load.
 * Needs NEXT_PUBLIC_WC_PROJECT_ID (free, from cloud.reown.com). The project id is public by design. */

export const WC_PROJECT_ID: string = (() => {
  try { return (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WC_PROJECT_ID) || ''; } catch { return ''; }
})();

let cached: Promise<any> | null = null;

async function init() {
  if (!WC_PROJECT_ID) throw new Error('WalletConnect is not configured on this deployment.');
  if (!cached) {
    cached = (async () => {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      const origin = window.location.origin;
      return EthereumProvider.init({
        projectId: WC_PROJECT_ID,
        chains: [1],
        optionalChains: [1, 10, 56, 137, 8453, 42161, 43114, 286623], // 286623 = SoDEX ValueChain, used for EIP-712 signing
        rpcMap: { 286623: 'https://mainnet.valuechain.xyz' },
        optionalMethods: ['eth_signTypedData_v4', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'personal_sign'],
        showQrModal: true,
        qrModalOptions: { themeMode: 'dark', themeVariables: { '--wcm-accent-color': '#f97316', '--wcm-background-color': '#0a0a0c' } as any },
        metadata: { name: 'SoSwap', description: 'Swap on the SoDEX order book. Non-custodial.', url: origin, icons: [origin + '/icons/icon-192.png'] },
      });
    })().catch((e) => { cached = null; throw e; });
  }
  return cached;
}

/** Opens the QR / wallet-list modal and resolves with an EIP-1193 provider once the user approves in their wallet. */
export async function connectWalletConnect(): Promise<any> {
  const p = await init();
  if (!p.session) await p.connect();
  else if (!p.accounts?.length) await p.enable();
  return p;
}

/** Returns the provider if a previous WalletConnect session is still alive on this device (no popup). */
export async function restoreWalletConnect(): Promise<any | null> {
  if (!WC_PROJECT_ID) return null;
  try {
    const p = await init();
    return p.session && p.accounts?.length ? p : null;
  } catch { return null; }
}
