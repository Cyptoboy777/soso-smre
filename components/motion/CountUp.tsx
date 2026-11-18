"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A formatted number ("$1,234.56", "≈ 0.0123", "0.12%") whose digits roll like an odometer.
 * Prefix, suffix, commas and the decimal stay put. A hidden copy of the final text reserves width.
 * First paint is already at the current value (no spin-up from zero). Prefers-reduced-motion skips the roll.
 */
const RE = /-?\d[\d,]*(?:\.\d+)?/;
const DIGITS = "0123456789";
type Parsed = { n: number };

function parse(s: string): Parsed | null {
  const m = RE.exec(s);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { n };
}

function reduced() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function CountUp({ value, duration = 420, className = "" }: { value: string; duration?: number; className?: string }) {
  const prev = useRef(value);
  const primed = useRef(false);
  const [flash, setFlash] = useState<"" | "up" | "down">("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => { primed.current = true; setReady(true); });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const from = parse(prev.current);
    const to = parse(value);
    prev.current = value;
    if (!from || !to || from.n === to.n || reduced() || document.hidden) return;
    setFlash(to.n > from.n ? "up" : "down");
    const t = window.setTimeout(() => setFlash(""), Math.max(700, duration + 200));
    return () => clearTimeout(t);
  }, [value, duration]);

  const tone = flash ? ` ss-count-${flash}` : "";
  const chars = Array.from(value);
  const skipWheel = reduced();

  return (
    <span className={`ss-count${tone} ${className}`.trim()} aria-label={value}>
      <span aria-hidden className="ss-count-ghost">{value}</span>
      {skipWheel ? (
        <span aria-hidden className="ss-count-live">{value}</span>
      ) : (
        <span aria-hidden className={`ss-count-live ss-odo${ready ? " is-ready" : ""}`}>
          {chars.map((ch, i) =>
            ch >= "0" && ch <= "9" ? (
              <span key={i} className="ss-odo-digit">
                <span className="ss-odo-strip" style={{ transform: `translateY(${-Number(ch)}em)` }}>
                  {Array.from(DIGITS).map((d) => <span key={d}>{d}</span>)}
                </span>
              </span>
            ) : (
              <span key={i} className="ss-odo-ch">{ch}</span>
            ),
          )}
        </span>
      )}
    </span>
  );
}
