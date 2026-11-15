"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

export default function AnimatedTabs({
  activeKey,
  children,
}: {
  activeKey: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, x: 10, filter: "blur(3px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, x: -8, filter: "blur(2px)" }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
