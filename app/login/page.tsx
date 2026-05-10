'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/FirebaseProvider';

export default function LoginPage() {
  const { user, signIn, loading, configured } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, router, user]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      if (!configured) throw new Error('Firebase config missing in .env.local');
      await signIn();
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading || user) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 32, height: 32, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: '20% auto auto 50%', transform: 'translateX(-50%)', width: 500, height: 500, background: 'rgba(37,99,235,0.10)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div className="fade-up" style={{ width: '100%', maxWidth: 562, position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'rgba(10,10,11,0.86)', border: '1px solid #262626', borderRadius: 28, padding: '20px 22px 24px', minHeight: 442, boxShadow: '0 24px 80px rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: 42 }}>
            <div style={{ width: 98, height: 98, background: 'rgba(255,255,255,0.06)', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              <Logo style={{ width: 56, height: 56 }} />
            </div>
            <h1 style={{ color: '#fff', fontSize: 38, fontWeight: 800, fontFamily: 'Georgia,serif', fontStyle: 'italic', letterSpacing: '-0.07em', lineHeight: 1 }}>SoSo Smre</h1>
            <p style={{ color: '#9ca3af', fontSize: 16, marginTop: 22 }}>[Smart Money Research Engine] - Elite Multi-Agent Intelligence.</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            style={{ width: '100%', minHeight: 60, borderRadius: 28, border: 'none', background: isSigningIn ? '#d4d4d8' : '#fff', color: '#050505', fontWeight: 800, cursor: isSigningIn ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, fontSize: 16 }}
          >
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '30px 0 32px' }}>
            <span style={{ height: 1, background: '#262626', flex: 1 }} />
            <span style={{ color: '#666', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Enterprise Access Only</span>
            <span style={{ height: 1, background: '#262626', flex: 1 }} />
          </div>

          <p style={{ color: '#4b5563', fontSize: 11, textAlign: 'center', fontFamily: 'monospace', letterSpacing: '.22em', textTransform: 'uppercase' }}>
            Authenticated via Federated Identity Engine
          </p>
        </div>
      </div>
    </div>
  );
}
