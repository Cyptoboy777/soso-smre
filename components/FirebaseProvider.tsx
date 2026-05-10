'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';

interface AuthContextValue {
  user: User | null;
  walletAddress: string | null;
  loading: boolean;
  configured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  connectWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedWallet = localStorage.getItem('sodex_wallet');
    if (savedWallet) setWalletAddress(savedWallet);

    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, nextUser => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    walletAddress,
    loading,
    configured: isFirebaseConfigured,
    signIn: async () => {
      if (!auth) throw new Error('Firebase is not configured');
      await signInWithPopup(auth, googleProvider);
    },
    signOut: async () => {
      if (auth) await firebaseSignOut(auth);
      setWalletAddress(null);
      localStorage.removeItem('sodex_wallet');
    },
    connectWallet: async () => {
      try {
        const { sodex } = await import('@/lib/sodex-sdk');
        const address = await sodex.connectWallet();
        if (address) {
          const message = `Welcome to SoSo Smre!\n\nSign this message to authenticate your SoDEX wallet.\nAddress: ${address}\nTimestamp: ${Date.now()}`;
          const signature = await sodex.signMessage(address, message);
          if (signature) {
            setWalletAddress(address);
            localStorage.setItem('sodex_wallet', address);
          }
        }
      } catch (e) {
        console.error("Wallet connection failed", e);
      }
    }
  }), [loading, user, walletAddress]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside FirebaseProvider');
  return context;
}
