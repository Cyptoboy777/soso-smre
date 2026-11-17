"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export default function AnimatedTabs({
  activeKey,
  children,
}: {
  activeKey: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, x: reduce ? 0 : 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
