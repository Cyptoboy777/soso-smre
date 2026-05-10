'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import NewsTicker from '@/components/NewsTicker';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/FirebaseProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!loading && !user && !isLogin) router.replace('/login');
  }, [isLogin, loading, router, user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 32, height: 32, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  if (isLogin) return <>{children}</>;
  if (!user) return null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar />
      <NewsTicker />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto', background: '#000' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
