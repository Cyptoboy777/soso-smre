'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Newspaper, Brain, Bot, BarChart2, Wallet,
  BookOpen, History, Settings, Search, ArrowRight, Command,
  TrendingUp, Zap, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CmdItem {
  id: string;
  label: string;
  description?: string;
  path?: string;
  Icon: React.ElementType;
  group: string;
  shortcut?: string;
  action?: () => void;
}

const PAGES: CmdItem[] = [
  { id: 'dashboard',     label: 'Dashboard',        description: 'Market overview & AI signals',   path: '/dashboard',      Icon: LayoutDashboard, group: 'Pages' },
  { id: 'sodex',         label: 'SoDEX Markets',    description: 'Live DEX trading pairs',          path: '/sodex-markets',  Icon: BarChart2,       group: 'Pages' },
  { id: 'news',          label: 'Breaking News',    description: 'Crypto market news feed',          path: '/breaking-news',  Icon: Newspaper,       group: 'Pages' },
  { id: 'ai-analysis',   label: 'AI Analysis',      description: 'Gemini-powered market analysis',  path: '/ai-analysis',    Icon: Brain,           group: 'Pages' },
  { id: 'ai-trade',      label: 'AI Trade Agent',   description: 'Autonomous trading bot',           path: '/ai-trade-agent', Icon: Bot,             group: 'Pages' },
  { id: 'backtest',      label: 'Backtest AI',      description: 'Historical strategy testing',      path: '/backtest',       Icon: History,         group: 'Pages' },
  { id: 'etf',           label: 'ETF Dashboard',    description: 'ETF flows & exposure',             path: '/etf-dashboard',  Icon: TrendingUp,      group: 'Pages' },
  { id: 'portfolio',     label: 'Portfolio',        description: 'Your holdings & PnL',             path: '/portfolio',      Icon: Wallet,          group: 'Pages' },
  { id: 'settings',      label: 'Settings',         description: 'Account & preferences',            path: '/settings',       Icon: Settings,        group: 'Pages' },
  { id: 'guidelines',    label: 'Guidelines',       description: 'Platform rules & DYOR',            path: '/guidelines',     Icon: BookOpen,        group: 'Pages' },
];

const ICON_COLORS: Record<string, string> = {
  Pages: 'var(--accent-blue)',
  Actions: 'var(--accent-orange)',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = PAGES.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    (item.description?.toLowerCase().includes(query.toLowerCase()))
  );

  const navigate = useCallback((item: CmdItem) => {
    if (item.action) { item.action(); }
    else if (item.path) { router.push(item.path); }
    onClose();
  }, [router, onClose]);

  // Focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { onClose(); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter')      { if (filtered[activeIdx]) navigate(filtered[activeIdx]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, activeIdx, navigate, onClose]);

  // Reset active index when query changes
  useEffect(() => { setActiveIdx(0); }, [query]);

  const groups = Array.from(new Set(filtered.map(f => f.group)));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', damping: 24, stiffness: 400 }}
            style={{
              width: 'min(640px, 92vw)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glow)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.15)',
            }}
          >
            {/* Search Input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <Search size={18} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search pages, actions..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                }}
              />
              <span style={{
                fontSize: 11, color: 'var(--text-dim)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)',
                padding: '2px 8px', borderRadius: 6,
                fontFamily: 'var(--font-mono)',
              }}>ESC</span>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : groups.map(group => (
                <div key={group}>
                  <div style={{
                    padding: '6px 18px 4px',
                    fontSize: 10, fontWeight: 800, letterSpacing: '.12em',
                    color: 'var(--text-dim)', textTransform: 'uppercase',
                  }}>
                    {group}
                  </div>
                  {filtered.filter(f => f.group === group).map((item, rawIdx) => {
                    const globalIdx = filtered.indexOf(item);
                    const isActive = globalIdx === activeIdx;
                    return (
                      <motion.div
                        key={item.id}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setActiveIdx(globalIdx)}
                        whileHover={{ x: 2 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 18px',
                          cursor: 'pointer',
                          background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                          borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 34, height: 34,
                          borderRadius: 10,
                          background: isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s',
                        }}>
                          <item.Icon size={16} color={isActive ? 'var(--accent-blue2)' : 'var(--text-dim)'} />
                        </div>

                        {/* Label */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 600,
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}>
                            {item.label}
                          </div>
                          {item.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                              {item.description}
                            </div>
                          )}
                        </div>

                        {/* Path hint */}
                        {item.path && (
                          <span style={{
                            fontSize: 11, color: 'var(--text-dim)',
                            fontFamily: 'var(--font-mono)',
                          }}>{item.path}</span>
                        )}
                        {isActive && <ArrowRight size={14} color="var(--accent-blue2)" />}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 18px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: 16,
              fontSize: 11, color: 'var(--text-dim)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Command size={12} /> K — Open
              </span>
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>ESC Close</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: 'var(--accent-blue)', fontSize: 11, fontWeight: 700 }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
