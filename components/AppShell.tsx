'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import NewsTicker from '@/components/NewsTicker';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/FirebaseProvider';
import DogAssistant from '@/components/DogAssistant';
import { Sun, Moon } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, walletAddress, loading } = useAuth();
  const [theme, setTheme] = useState<'night' | 'day'>('night');
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!loading && !user && !walletAddress && !isLogin) {
      router.replace('/login');
    }
  }, [isLogin, loading, router, user, walletAddress]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 28, height: 28, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  if (isLogin) return <>{children}</>;
  if (!user && !walletAddress) return null;

  return (
    <div data-theme={theme} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-main)', color: 'var(--text-primary)', transition: 'all 0.4s ease' }}>
      <TopBar />
      
      <NewsTicker />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar theme={theme} setTheme={setTheme} />
        <main style={{ flex: 1, overflowY: 'auto', background: 'transparent', position: 'relative' }}>
          {/* Subtle Ambient Glow (Only in Night Mode) */}
          {theme === 'night' && (
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(249,115,22,0.03)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
          )}
          <div key={pathname} className="page-in" style={{ position: 'relative', zIndex: 1, minHeight: '100%' }}>
            {children}
          </div>
        </main>
      </div>
      <DogAssistant />
    </div>
  );
}
