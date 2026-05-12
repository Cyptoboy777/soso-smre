'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; message: string; type: ToastType; }
interface ToastCtx { toast: (msg: string, type?: ToastType) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

const ICONS: Record<ToastType, string> = {
  success: '✅', error: '❌', info: '⚡', warning: '⚠️',
};
const COLORS: Record<ToastType, { bg: string; border: string; glow: string }> = {
  success: { bg: 'rgba(0,230,118,0.1)', border: 'rgba(0,230,118,0.3)', glow: '#00e676' },
  error:   { bg: 'rgba(244,63,94,0.1)',  border: 'rgba(244,63,94,0.3)',  glow: '#f43f5e' },
  info:    { bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)', glow: '#38bdf8' },
  warning: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', glow: '#f97316' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  const c = COLORS[toast.type];

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10);
    const t2 = setTimeout(() => { setVisible(false); setTimeout(onRemove, 400); }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onRemove]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: c.bg, border: `1px solid ${c.border}`,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${c.glow}22`,
      backdropFilter: 'blur(20px)',
      borderRadius: 12, padding: '12px 16px',
      minWidth: 280, maxWidth: 360,
      transform: visible ? 'translateX(0)' : 'translateX(120%)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
      cursor: 'pointer',
    }} onClick={() => { setVisible(false); setTimeout(onRemove, 400); }}>
      <span style={{ fontSize: 16 }}>{ICONS[toast.type]}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, flex: 1 }}>
        {toast.message}
      </span>
      <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, flexShrink: 0 }}>✕</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter.current;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onRemove={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
