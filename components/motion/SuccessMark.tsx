"use client";

import { motion, useReducedMotion } from "framer-motion";

/** One-shot success state: a ring settles in and a check draws itself. Static when reduced motion is on. */
export default function SuccessMark({ title, sub }: { title: string; sub?: string }) {
  const reduce = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <div role="status" aria-live="polite" className="ss-success">
      <motion.div
        className="ss-success-ring"
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
      >
        <span aria-hidden className="ss-success-pulse" />
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden>
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.42, delay: 0.12, ease }}
          />
        </svg>
      </motion.div>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.18, ease }}
        className="min-w-0"
      >
        <div className="text-sm font-semibold text-zinc-50">{title}</div>
        {sub && <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">{sub}</div>}
      </motion.div>
    </div>
  );
}
