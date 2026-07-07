'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import { detectWallets, connectToWallet, signAuthMessage, verifyAuthProof, type WalletProvider, type AuthProof } from '@/lib/walletConnectors';

const AUTH_PROOF_KEY = 'sodex_auth_proof';

export interface AuthContextValue {
  user: User | null;
  walletAddress: string | null;
  walletId: string | null;           // which wallet was used
  availableWallets: WalletProvider[];
  loading: boolean;
  configured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  connectWallet: (walletId?: string) => Promise<void>;
  refreshWallets: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user,             setUser]           = useState<User | null>(null);
  const [walletAddress,    setWalletAddress]  = useState<string | null>(null);
  const [walletId,         setWalletId]       = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [loading,          setLoading]        = useState(true);

  // Detect wallets on mount
  const refreshWallets = useCallback(() => {
    setAvailableWallets(detectWallets());
  }, []);

  useEffect(() => {
    // Restore saved wallet session, but only trust it if the stored signature
    // still verifies against the stored address+message. Without this check,
    // anyone could spoof a session with `localStorage.setItem('sodex_wallet', '0x...')`.
    const restoreWalletSession = async () => {
      const savedWalletId = localStorage.getItem('sodex_wallet_id');
      const savedProofRaw = localStorage.getItem(AUTH_PROOF_KEY);
      if (!savedProofRaw) return;

      try {
        const proof = JSON.parse(savedProofRaw) as AuthProof;
        const valid = await verifyAuthProof(proof);
        if (valid) {
          setWalletAddress(proof.address);
          setWalletId(savedWalletId);
        } else {
          localStorage.removeItem('sodex_wallet');
          localStorage.removeItem('sodex_wallet_id');
          localStorage.removeItem(AUTH_PROOF_KEY);
        }
      } catch {
        localStorage.removeItem('sodex_wallet');
        localStorage.removeItem('sodex_wallet_id');
        localStorage.removeItem(AUTH_PROOF_KEY);
      }
    };

    restoreWalletSession();

    // Detect installed wallets
    refreshWallets();

    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, nextUser => {
      setUser(nextUser);
      setLoading(false);
    });
  }, [refreshWallets]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    walletAddress,
    walletId,
    availableWallets,
    loading,
    configured: isFirebaseConfigured,

    signIn: async () => {
      if (!auth) throw new Error('Firebase not configured');
      await signInWithPopup(auth, googleProvider);
    },

    signOut: async () => {
      if (auth) await firebaseSignOut(auth);
      setWalletAddress(null);
      setWalletId(null);
      localStorage.removeItem('sodex_wallet');
      localStorage.removeItem('sodex_wallet_id');
      localStorage.removeItem(AUTH_PROOF_KEY);
    },

    /**
     * connectWallet(walletId?)
     * If walletId is given, connects to that specific wallet.
     * If omitted, uses the first detected wallet (or shows picker via UI).
     */
    connectWallet: async (targetId?: string) => {
      const wallets = detectWallets();
      if (wallets.length === 0) {
        alert('No Web3 wallet extension detected.\nInstall MetaMask, Rabby, OKX, or any EVM wallet extension.');
        return;
      }
      const wallet = targetId
        ? wallets.find(w => w.id === targetId) ?? wallets[0]
        : wallets[0];

      try {
        const address = await connectToWallet(wallet.provider);
        const proof   = await signAuthMessage(wallet.provider, address);

        const valid = await verifyAuthProof(proof);
        if (!valid) throw new Error('Wallet signature verification failed');

        setWalletAddress(address);
        setWalletId(wallet.id);
        localStorage.setItem('sodex_wallet',    address);
        localStorage.setItem('sodex_wallet_id', wallet.id);
        localStorage.setItem(AUTH_PROOF_KEY, JSON.stringify(proof));
      } catch (e) {
        console.error('Wallet connection failed:', e);
        throw e;
      }
    },

    refreshWallets,
  }), [loading, user, walletAddress, walletId, availableWallets, refreshWallets]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside FirebaseProvider');
  return ctx;
}
