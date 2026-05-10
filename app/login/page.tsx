'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/FirebaseProvider';

export default function LoginPage() {
  const { user, walletAddress, signIn, connectWallet, loading, configured } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!loading && (user || walletAddress)) {
      router.replace('/');
    }
  }, [loading, router, user, walletAddress]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      if (!configured) throw new Error('Firebase config missing');
      await signIn();
      router.replace('/');
    } catch (e) {
      setError('Google sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleConnectWallet = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      await connectWallet();
      // After success, useEffect will handle redirect
    } catch (e) {
      setError('Wallet connection failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading || user || walletAddress) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 32, height: 32, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: '20% auto auto 50%', transform: 'translateX(-50%)', width: 500, height: 500, background: 'rgba(37,99,235,0.10)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div className="fade-up" style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'rgba(10,10,11,0.86)', border: '1px solid #262626', borderRadius: 28, padding: '42px', boxShadow: '0 24px 80px rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ textAlign: 'center', marginBottom: 42 }}>
            <div style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.06)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              <Logo style={{ width: 44, height: 44 }} />
            </div>
            <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, fontFamily: 'Georgia,serif', fontStyle: 'italic', letterSpacing: '-0.07em', lineHeight: 1 }}>SoSo Smre</h1>
            <p style={{ color: '#666', fontSize: 13, marginTop: 12 }}>Elite AI-Agent Research Infrastructure.</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, marginBottom: 24 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              style={{ width: '100%', minHeight: 54, borderRadius: 12, border: '1px solid #2a2a2a', background: '#111', color: '#fff', fontWeight: 600, cursor: isSigningIn ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 14 }}
            >
              <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {isSigningIn ? 'Connecting...' : 'Sign in with Google'}
            </button>

            <button
              onClick={handleConnectWallet}
              disabled={isSigningIn}
              style={{ width: '100%', minHeight: 54, borderRadius: 12, border: 'none', background: 'linear-gradient(90deg, #f97316, #fb923c)', color: '#000', fontWeight: 800, cursor: isSigningIn ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 14, boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
              {isSigningIn ? 'Syncing...' : 'Connect SoDEX Wallet'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '32px 0' }}>
            <span style={{ height: 1, background: '#262626', flex: 1 }} />
            <span style={{ color: '#444', fontSize: 9, fontWeight: 800 }}>OR</span>
            <span style={{ height: 1, background: '#262626', flex: 1 }} />
          </div>

          <p style={{ color: '#333', fontSize: 9, textAlign: 'center', fontFamily: 'monospace', letterSpacing: '.18em', textTransform: 'uppercase', lineHeight: 1.6 }}>
            Secured via SoDEX EIP-712 Protocol<br/>& Federated Identity Engine
          </p>
        </div>
      </div>
    </div>
  );
}
