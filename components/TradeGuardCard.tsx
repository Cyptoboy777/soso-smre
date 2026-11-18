"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { formatUsd, type GuardResult, type GuardVerdict } from "@/lib/trade-guard";

const LABEL: Record<GuardVerdict, string> = {
  good: "Good to go",
  wait: "Wait",
  risky: "Risky",
};

export default function TradeGuardCard({
  result,
  safeSize,
  onSafeSize,
}: {
  result: GuardResult;
  safeSize?: string | null;
  onSafeSize?: (amount: string) => void;
}) {
  const reduce = useReducedMotion();
  const { verdict, reasons, costUsd, costParts, mood, depthText, portfolioText } = result;
  return (
    <motion.section
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="ss-guard ss-lift"
      data-verdict={verdict}
      data-testid="trade-guard"
      aria-live="polite"
    >
      <div className="ss-guard__top">
        <div className="ss-guard__title"><ShieldCheck className="h-4 w-4 text-orange-400" />Trade Guard</div>
        <span className="ss-guard__badge">{LABEL[verdict]}</span>
      </div>
      <div className="ss-guard__rows">
        {costUsd != null && (
          <div className="ss-guard__row">
            <span className="ss-guard__k">Estimated cost</span>
            <span className="ss-guard__v ss-guard__cost">
              {formatUsd(costUsd, 2)}
              {costParts ? <span className="block text-[11px] font-medium text-zinc-500">Fees {formatUsd(costParts.fees, 3)} · Spread {formatUsd(costParts.spread, 3)} · Slippage {formatUsd(costParts.slippage, 3)}</span> : null}
            </span>
          </div>
        )}
        {mood && (
          <div className="ss-guard__row">
            <span className="ss-guard__k">Market mood</span>
            <span className="ss-guard__v">{mood.text}</span>
          </div>
        )}
        {depthText && (
          <div className="ss-guard__row">
            <span className="ss-guard__k">Book depth</span>
            <span className="ss-guard__v">{depthText}</span>
          </div>
        )}
        {portfolioText && (
          <div className="ss-guard__row">
            <span className="ss-guard__k">Your size</span>
            <span className="ss-guard__v">{portfolioText}</span>
          </div>
        )}
      </div>
      {!!reasons.length && (
        <ul className="ss-guard__reasons">
          {reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      <p className="ss-guard__hint">Based on the live order book and SoSoValue data right now. Not a prediction or advice.</p>
      {verdict === "risky" && safeSize && onSafeSize && (
        <button type="button" className="ss-guard__safe" onClick={() => onSafeSize(safeSize)}>
          Use safe size ({safeSize})
        </button>
      )}
    </motion.section>
  );
}
