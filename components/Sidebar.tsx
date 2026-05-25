'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Newspaper, Brain, Bot, BarChart2, Wallet,
  BookOpen, History, Settings, Sun, Moon, ChevronLeft, ChevronRight,
  TrendingUp, Wifi, WifiOff, Command,
} from 'lucide-react';
import { useAuth } from '@/components/FirebaseProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Logo } from '@/components/Logo';

const NAV = [
  { href: '/dashboard',      label: 'Dashboard',     Icon: LayoutDashboard, description: 'Overview' },
  { href: '/sodex-markets',  label: 'SoDEX Markets', Icon: BarChart2,       description: 'DEX Trading' },
  { href: '/trading-bot',    label: 'Trading Bot',   Icon: Bot,             description: 'Auto Bot' },
  { href: '/breaking-news',  label: 'Breaking News', Icon: Newspaper,       description: 'Market News' },
  { href: '/ai-analysis',    label: 'AI Analysis',   Icon: Brain,           description: 'Gemini AI' },
  { href: '/ai-trade-agent', label: 'AI Trade Agent',Icon: TrendingUp,      description: 'Auto Trading' },
  { href: '/backtest',       label: 'Backtest AI',   Icon: History,         description: 'Strategy Test' },
  { href: '/etf-dashboard',  label: 'ETF Dashboard', Icon: TrendingUp,      description: 'ETF Flows' },
  { href: '/portfolio',      label: 'Portfolio',     Icon: Wallet,          description: 'Holdings & PnL' },
  { href: '/settings',       label: 'Settings',      Icon: Settings,        description: 'Preferences' },
  { href: '/guidelines',     label: 'Guidelines',    Icon: BookOpen,        description: 'DYOR Rules' },
];

interface SidebarProps {
  theme?: 'night' | 'day';
  setTheme?: (t: 'night' | 'day') => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  onCmdOpen?: () => void;
}

export default function Sidebar({ theme, setTheme, collapsed, setCollapsed, onCmdOpen }: SidebarProps) {
  const path = usePathname();
  const { user, walletAddress, signIn, signOut, connectWallet } = useAuth();

  const W = collapsed ? 60 : 240;

  return (
    <motion.aside
      animate={{ width: W }}
      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      style={{
        position: 'relative',
        background: 'var(--bg-sidebar)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        zIndex: 40,
        boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Subtle top-gradient accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-purple), var(--accent-blue))',
        opacity: 0.6,
      }} />

      {/* LOGO SECTION */}
      <div style={{
        padding: collapsed ? '16px 0' : '16px 16px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        minHeight: 62,
      }}>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Logo mode="compact" style={{ width: 28, height: 28 }} />
            </motion.div>
          )}
          {collapsed && (
            <motion.div
              key="logo-mini"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              style={{ flexShrink: 0 }}
            >
              <Logo mode="icon" style={{ width: 32, height: 32 }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle (only when expanded) */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{
              width: 26, height: 26,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8, cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}
            title="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Expand toggle when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            margin: '8px auto 0',
            width: 34, height: 34,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10, cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          title="Expand sidebar"
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* SECTION LABEL */}
      {!collapsed && (
        <div style={{ padding: '14px 18px 6px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.18em' }}>
          NAVIGATION
        </div>
      )}

      {/* NAV ITEMS */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV.map(({ href, label, Icon, description }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 11,
                  padding: collapsed ? '10px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10,
                  position: 'relative',
                  background: active
                    ? 'linear-gradient(90deg, rgba(124,58,237,0.16), rgba(6,182,212,0.06))'
                    : 'transparent',
                  color: active ? '#a78bfa' : 'var(--text-secondary)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  border: active
                    ? '1px solid rgba(124,58,237,0.22)'
                    : '1px solid transparent',
                }}
              >
                {/* Active bar — purple→cyan gradient */}
                {active && (
                  <div className="nav-active-bar" style={{
                    boxShadow: '0 0 12px rgba(124,58,237,0.7)',
                  }} />
                )}

                {/* Icon with glow on active */}
                <div style={{
                  width: collapsed ? 38 : 28,
                  height: collapsed ? 38 : 28,
                  borderRadius: collapsed ? 10 : 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                  transition: 'all 0.2s',
                  boxShadow: active ? '0 0 14px rgba(124,58,237,0.25)' : 'none',
                }}>
                  <Icon
                    size={collapsed ? 18 : 16}
                    style={{
                      marginLeft: active && !collapsed ? 4 : 0,
                      filter: active ? 'drop-shadow(0 0 6px rgba(249,115,22,0.5))' : 'none',
                      transition: 'all 0.2s',
                    }}
                  />
                </div>

                {/* Label */}
                {!collapsed && (
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      letterSpacing: active ? '0.01em' : 'normal',
                      lineHeight: 1.2,
                    }}>
                      {label}
                    </div>
                  </div>
                )}
              </motion.div>
            </Link>
          );
        })}

        {/* ─── APPEARANCE SECTION ─── */}
        <div style={{ marginTop: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          {!collapsed && (
            <div style={{ padding: '0 4px 8px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.15em' }}>
              TOOLS
            </div>
          )}

          {/* Command Palette shortcut */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onCmdOpen}
            title="Command Palette (Ctrl+K)"
            style={{
              width: '100%', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 10,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.1)',
              color: 'var(--accent-blue2)',
              marginBottom: 6,
              transition: 'all 0.2s',
            }}
          >
            <Command size={collapsed ? 18 : 15} />
            {!collapsed && (
              <>
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1, textAlign: 'left' }}>Command</span>
                <span style={{
                  fontSize: 10, color: 'var(--text-dim)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1px 6px', borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                }}>⌘K</span>
              </>
            )}
          </motion.button>

          {/* Theme Toggle */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setTheme?.(theme === 'night' ? 'day' : 'night')}
            title={`Switch to ${theme === 'night' ? 'Day' : 'Night'} mode`}
            style={{
              width: '100%', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 10,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              transition: 'all 0.2s',
            }}
          >
            {theme === 'night'
              ? <Moon size={collapsed ? 18 : 15} color="var(--accent-purple)" />
              : <Sun size={collapsed ? 18 : 15} color="var(--accent-orange)" />
            }
            {!collapsed && (
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {theme === 'night' ? 'Night Mode' : 'Day Mode'}
              </span>
            )}
          </motion.button>
        </div>
      </nav>

      {/* ─── WALLET / AUTH SECTION ─── */}
      <div style={{
        padding: collapsed ? '12px 8px' : '14px 12px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(255,255,255,0.015)',
        backdropFilter: 'blur(10px)',
      }}>
        {!user && !walletAddress ? (
          collapsed ? (
            <button
              onClick={signIn}
              title="Sign in"
              style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                background: 'var(--accent-orange)', border: 'none',
                color: '#fff', fontSize: 11, fontWeight: 900,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 16 }}>→</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={signIn}
                style={{
                  width: '100%', padding: '9px', borderRadius: 10,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-bold)',
                  color: 'var(--text-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                LOGIN
              </button>
              <button
                onClick={() => connectWallet()}
                style={{
                  width: '100%', padding: '9px', borderRadius: 10,
                  background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-purple))',
                  border: 'none', color: '#fff',
                  fontSize: 11, fontWeight: 900, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
                }}
              >
                CONNECT WALLET
              </button>
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!collapsed && walletAddress && (
              <div style={{
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.12)',
                padding: '8px 10px', borderRadius: 10,
              }}>
                <div style={{ fontSize: 9, color: 'var(--accent-blue2)', fontWeight: 800, marginBottom: 3, letterSpacing: '.1em' }}>WALLET</div>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
              </div>
            )}
            {!collapsed && user && (
              <div style={{
                background: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.12)',
                padding: '8px 10px', borderRadius: 10,
              }}>
                <div style={{ fontSize: 9, color: 'var(--accent-orange)', fontWeight: 800, marginBottom: 3, letterSpacing: '.1em' }}>USER</div>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.displayName ?? user?.email}
                </div>
              </div>
            )}
            <button
              onClick={signOut}
              style={{
                width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent',
                border: '1px solid var(--border-bold)',
                color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              {collapsed ? '×' : 'LOGOUT'}
            </button>
          </div>
        )}
      </div>

      {/* System status */}
      <div style={{
        padding: collapsed ? '10px 0' : '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        justifyContent: collapsed ? 'center' : 'flex-start',
        opacity: 0.7,
      }}>
        <div
          className="badge-live"
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--accent-green)',
            boxShadow: '0 0 8px var(--accent-green)',
            flexShrink: 0,
          }}
        />
        {!collapsed && (
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.1em' }}>
            SYSTEM ONLINE
          </span>
        )}
      </div>
    </motion.aside>
  );
}
