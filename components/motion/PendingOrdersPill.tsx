'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import type { FlightStatus } from '@/lib/swap-ux';

export type FlightRow = {
  localId: string;
  orderID?: number;
  label: string;
  status: FlightStatus;
  detail?: string;
  startedAt: number;
  settledAt?: number;
};

const HIDE_AFTER_MS = 4000;

const STATUS: Record<FlightStatus, { label: string; tone: string }> = {
  submitting: { label: 'Submitting', tone: 'wait' },
  submitted: { label: 'Submitted', tone: 'wait' },
  filled: { label: 'Filled', tone: 'ok' },
  partial: { label: 'Partially filled', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
};

function isSettled(s: FlightStatus) {
  return s === 'filled' || s === 'failed' || s === 'cancelled';
}

export default function PendingOrdersPill({
  flights,
  onOpenDetails,
  onDismiss,
}: {
  flights: FlightRow[];
  onOpenDetails: (orderID?: number) => void;
  onDismiss?: () => void;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!flights.length) return;
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(id);
  }, [flights.length]);

  const visible = flights.filter((f) => {
    if (!isSettled(f.status) && f.status !== 'submitted' && f.status !== 'partial' && f.status !== 'submitting') return false;
    if (f.settledAt && now - f.settledAt >= HIDE_AFTER_MS) return false;
    // Resting submitted limit orders hide after the same window once they are on the book.
    if (f.status === 'submitted' && !f.settledAt && now - f.startedAt >= HIDE_AFTER_MS + 4000) return false;
    return true;
  });

  useEffect(() => { if (!visible.length) setOpen(false); }, [visible.length]);

  if (!visible.length) return null;

  const active = visible.filter((f) => !isSettled(f.status)).length;
  const head = active
    ? `${active} order${active === 1 ? '' : 's'} in flight`
    : visible.every((f) => f.status === 'filled')
      ? 'Order filled'
      : visible.length === 1
        ? STATUS[visible[0].status].label
        : 'Orders updated';

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        aria-live="polite"
        className="ss-flight-pill"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: reduce ? 0 : 0.28, ease }}
      >
        <button type="button" className="ss-flight-pill-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={active ? 'ss-flight-dot is-live' : 'ss-flight-dot is-done'} />
          <span className="ss-flight-pill-title">{head}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {onDismiss && isSettled(visible[0]?.status) && (
          <button type="button" className="ss-flight-pill-x" aria-label="Dismiss" onClick={onDismiss}><X className="h-3.5 w-3.5" /></button>
        )}
        <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              className="ss-flight-list"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease }}
            >
              {visible.map((f) => (
                <li key={f.localId}>
                  <button type="button" onClick={() => onOpenDetails(f.orderID)}>
                    <span className={`ss-flight-status is-${STATUS[f.status].tone}`}>{STATUS[f.status].label}</span>
                    <span className="ss-flight-label">{f.label}{f.detail ? ` · ${f.detail}` : ''}</span>
                    <span className="ss-flight-go">Details</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
