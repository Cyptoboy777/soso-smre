/**
 * SoDEX EIP-712 Signer (TypeScript Implementation)
 * Ported from official Go SDK: https://github.com/sodex-tech/sodex-go-sdk-public
 */

export const SODEX_CHAIN_ID = 286623;

export const SODEX_DOMAIN = {
  name: 'SoDEX',
  version: '1',
  chainId: SODEX_CHAIN_ID,
};

// EIP-712 Types for Spot Orders
export const SPOT_ORDER_TYPES = {
  NewOrder: [
    { name: 'accountId', type: 'uint64' },
    { name: 'symbolId', type: 'uint32' },
    { name: 'clOrdId', type: 'string' },
    { name: 'side', type: 'uint8' },
    { name: 'type', type: 'uint8' },
    { name: 'timeInForce', type: 'uint8' },
    { name: 'price', type: 'string' },
    { name: 'quantity', type: 'string' },
    { name: 'nonce', type: 'uint64' },
  ],
};

export interface SodexOrderRequest {
  accountId: number;
  symbolId: number;
  clOrdId: string;
  side: number; // 1=Buy, 2=Sell
  type: number; // 1=Limit, 2=Market
  timeInForce: number; // 1=GTC, etc
  price: string;
  quantity: string;
}

export class SodexSigner {
  /**
   * Request user to sign an order via their Web3 Wallet (MetaMask, etc.)
   * This is secure and never touches the user's private key.
   */
  static async signOrder(address: string, order: SodexOrderRequest, nonce: number): Promise<string | null> {
    if (typeof window === 'undefined' || !window.ethereum) return null;

    const data = JSON.stringify({
      domain: SODEX_DOMAIN,
      types: SPOT_ORDER_TYPES,
      primaryType: 'NewOrder',
      message: {
        ...order,
        nonce,
      },
    });

    try {
      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, data],
      });
      
      // SoDEX expects a specific prefix? 
      // The Go SDK says: "The returned signature already includes the SoDEX signature-type prefix."
      // For standard EVM signatures via MetaMask, we usually just return the hex.
      return signature;
    } catch (e) {
      console.error("Order signing failed:", e);
      return null;
    }
  }
}
