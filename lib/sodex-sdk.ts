/**
 * SoDEX Unified SDK Setup
 * Handles Authentication (Email/Web3) and Secure Wallet Connections
 */

export interface SodexUser {
  id: string;
  method: 'EMAIL' | 'WALLET';
  address?: string;
  email?: string;
}

export class SodexSDK {
  private static instance: SodexSDK;
  
  private constructor() {}

  static getInstance() {
    if (!SodexSDK.instance) SodexSDK.instance = new SodexSDK();
    return SodexSDK.instance;
  }

  /**
   * Connect to a Web3 Wallet securely
   * No private key access - uses standard browser providers
   */
  async connectWallet(): Promise<string | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert("Please install a Web3 wallet like MetaMask to connect.");
      return null;
    }

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (accounts.length > 0) {
        return accounts[0];
      }
      return null;
    } catch (error) {
      console.error("Wallet connection failed:", error);
      return null;
    }
  }

  /**
   * Mock Sign-In with Ethereum (SIWE)
   * Requests a signature to verify ownership without moving funds
   */
  async signMessage(address: string, message: string): Promise<string | null> {
    if (!window.ethereum) return null;
    try {
      // Convert message to hex for broader compatibility
      const hexMsg = `0x${Buffer.from(message, 'utf8').toString('hex')}`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [hexMsg, address],
      }) as string;
      return signature;
    } catch (e) {
      console.error("Signing failed:", e);
      return null;
    }
  }
}

export const sodex = SodexSDK.getInstance();

// Type definition for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
