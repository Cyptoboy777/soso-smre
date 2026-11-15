"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function SwapFeedback({
  status,
}: {
  status: "idle" | "preview" | "pending" | "success" | "error";
}) {
  const copy = {
    idle: "",
    preview: "Route preview ready. Review every detail before you sign.",
    pending: "Signing with your trading key and waiting for the fill…",
    success: "Fill confirmed by SoDEX. Double-check it under Portfolio.",
    error: "The swap did not complete. Read the message in the review window, then try again.",
  }[status];

  return (
    <AnimatePresence mode="wait">
      {copy && (
        <motion.div
          key={status}
          role="status"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className={`ss-motion-feedback ss-motion-feedback--${status}`}
        >
          <span className="ss-motion-feedback__dot" />
          {copy}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
