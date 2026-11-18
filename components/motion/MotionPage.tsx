"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** Screen change: mobile slides + scales with a spring; desktop fades up. Reduced-motion is opacity only. */
export default function MotionPage({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={reduce ? undefined : "ss-screen"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: reduce ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0.01 : 0.12, ease: "easeOut" } }}
    >
      {children}
    </motion.div>
  );
}
