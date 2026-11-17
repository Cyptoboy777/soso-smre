"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Target } from "lucide-react";
import type { ExitSuggestion } from "@/lib/trade-guard";

export default function SmartExitCard({
  suggestion,
  optional,
  onPrefill,
}: {
  suggestion: ExitSuggestion;
  optional?: boolean;
  onPrefill: (kind: "tp" | "stop") => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="ss-exit"
      data-testid="smart-exit"
    >
      <div className="ss-exit__title"><Target className="h-4 w-4 text-orange-400" />{optional ? "If this fills, a 1:2 exit could look like this" : "Suggested 1:2 exit"}</div>
      <div className="ss-exit__grid">
        <div className="ss-exit__cell"><span>Entry (ref.)</span><b>{suggestion.entry}</b></div>
        <div className="ss-exit__cell"><span>Size</span><b>{suggestion.qty}</b></div>
        <div className="ss-exit__cell is-tp"><span>Take profit</span><b>{suggestion.takeProfit}</b></div>
        <div className="ss-exit__cell is-sl"><span>Stop</span><b>{suggestion.stop}</b></div>
      </div>
      <p className="ss-exit__note">{suggestion.note}</p>
      <div className="ss-exit__actions">
        <button type="button" className="ss-exit__btn is-primary" onClick={() => onPrefill("tp")}>
          Prefill take-profit limit
        </button>
        <button type="button" className="ss-exit__btn" onClick={() => onPrefill("stop")}>
          Prefill stop limit
        </button>
      </div>
    </motion.section>
  );
}
