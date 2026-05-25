'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import NewsTicker from '@/components/NewsTicker';
import TickerTape from '@/components/TickerTape';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/FirebaseProvider';
import SoDoggyAssistant from '@/components/SoDoggy/SoDoggyAssistant';
import { ToastProvider } from '@/components/ToastProvider';
import SodexPriceBridge from '@/components/SodexPriceBridge';
import CommandPalette from '@/components/CommandPalette';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, walletAddress, loading } = useAuth();
  const [theme, setTheme] = useState<'night' | 'day'>('night');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const isPublicPage = pathname === '/stellar' || pathname === '/aurora';

  // ── Auth guard ──────────────────────────────────────
  useEffect(() => {
    if (!loading && !user && !walletAddress && !isLogin && !isPublicPage) {
      router.replace('/login');
    }
  }, [isLogin, loading, router, user, walletAddress]);

  // ── Ctrl+K command palette ──────────────────────────
  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Responsive: auto-collapse on small screens ──────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches) setSidebarCollapsed(true);
    const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Loading state ────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-main)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        {/* Premium loading animation */}
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid var(--border-subtle)',
            borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid transparent',
            borderTopColor: 'var(--accent-orange)',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 8,
            border: '2px solid transparent',
            borderTopColor: 'var(--accent-purple)',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite reverse',
          }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '.15em' }}>
          INITIALIZING...
        </div>
      </div>
    );
  }

  if (isLogin || isPublicPage) return <>{children}</>;
  if (!user && !walletAddress) return null;

  return (
    <ToastProvider>
      <SodexPriceBridge />
      <CommandPalette open={cmdOpen} onClose={closeCmd} />

      <div
        data-theme={theme}
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-main)',
          color: 'var(--text-primary)',
          transition: 'background 0.5s cubic-bezier(0.4, 0, 0.2, 1), color 0.5s',
        }}
      >
        {/* ── Premium BG Orbs (from smre-dashboard.html) ── */}
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        {/* Scanline crypto texture */}
        {theme === 'night' && <div className="scanlines-overlay" />}

        <TopBar onCmdOpen={openCmd} />
        <TickerTape />
        <NewsTicker />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            theme={theme}
            setTheme={setTheme}
            collapsed={sidebarCollapsed}
            setCollapsed={setSidebarCollapsed}
            onCmdOpen={openCmd}
          />

          <main style={{
            flex: 1, overflowY: 'auto',
            background: 'transparent',
            position: 'relative',
          }}>
            {/* Stronger ambient glow ─ always on */}
            <>
              <div style={{
                position: 'fixed', top: '-8%', right: '-8%',
                width: '42%', height: '46%',
                background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)',
                filter: 'blur(70px)',
                borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
              }} />
              <div style={{
                position: 'fixed', bottom: '8%', left: '12%',
                width: '34%', height: '34%',
                background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)',
                filter: 'blur(90px)',
                borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
              }} />
              <div style={{
                position: 'fixed', top: '40%', right: '25%',
                width: '22%', height: '28%',
                background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)',
                filter: 'blur(60px)',
                borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
              }} />
            </>

            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6, scale: 0.99, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'relative', zIndex: 1, minHeight: '100%' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <SoDoggyAssistant />
      </div>
    </ToastProvider>
  );
}
