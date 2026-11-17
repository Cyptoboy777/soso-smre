"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Home hero stage: "two sides of a swap". An orange arc and a white arc chase each other
 * around the mark (the same two halves as the logo), a slow dial turns behind them, and two
 * tokens ride a tilted orbit that passes behind the logo. All motion is CSS transform/opacity
 * on a handful of layers, paused when off screen. Pointer or device tilt adds a small parallax.
 */
function Plane() {
  return (
    <div className="ss-orbit-3d">
      <div className="ss-orbit-plane">
        <div className="ss-orbit-path" />
        <div className="ss-orbit-spin">
          <span className="ss-orbit-token ss-orbit-token-o" />
          <span className="ss-orbit-token ss-orbit-token-w" />
        </div>
      </div>
    </div>
  );
}

const TICKS = Array.from({ length: 72 }, (_, i) => i);

export default function HeroOrbit({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 18, mass: 0.6 });
  const backX = useTransform(sx, (v) => v * -8);
  const backY = useTransform(sy, (v) => v * -8);
  const midX = useTransform(sx, (v) => v * 6);
  const midY = useTransform(sy, (v) => v * 6);
  const frontX = useTransform(sx, (v) => v * 14);
  const frontY = useTransform(sy, (v) => v * 14);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) { mx.set(0); my.set(0); return; }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mx.set(clamp((e.clientX / window.innerWidth) * 2 - 1));
      my.set(clamp((e.clientY / window.innerHeight) * 2 - 1));
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      mx.set(clamp(e.gamma / 30));
      my.set(clamp((e.beta - 45) / 30));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    // Android and desktop only; iOS needs a permission prompt, which a hero should not trigger.
    const DOE = typeof window !== "undefined" ? (window as any).DeviceOrientationEvent : undefined;
    const tilt = DOE && typeof DOE.requestPermission !== "function";
    if (tilt) window.addEventListener("deviceorientation", onTilt, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (tilt) window.removeEventListener("deviceorientation", onTilt);
    };
  }, [reduce, mx, my]);

  return (
    <div ref={box} aria-hidden className={`ss-orbit ${paused ? "is-paused" : ""}`}>
      <motion.div className="ss-orbit-layer" style={{ x: backX, y: backY }}>
        <div className="ss-orbit-glow" />
        <svg className="ss-orbit-dial" viewBox="0 0 200 200">
          {TICKS.map((i) => (
            <line key={i} x1="100" y1="3" x2="100" y2={i % 6 === 0 ? 11 : 7}
              stroke={i % 18 === 0 ? "rgba(251,146,60,.75)" : "rgba(255,255,255,.16)"} strokeWidth={i % 6 === 0 ? 1.1 : 0.7}
              transform={`rotate(${i * 5} 100 100)`} />
          ))}
        </svg>
      </motion.div>

      <motion.div className="ss-orbit-layer" style={{ x: midX, y: midY }}>
        <svg className="ss-orbit-arc ss-orbit-arc-a" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="78" fill="none" stroke="url(#ssArcO)" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="150 340" />
          <defs><linearGradient id="ssArcO" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fdba74" stopOpacity="0" /><stop offset="1" stopColor="#f97316" /></linearGradient></defs>
        </svg>
        <svg className="ss-orbit-arc ss-orbit-arc-b" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="66" fill="none" stroke="url(#ssArcW)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="110 305" />
          <defs><linearGradient id="ssArcW" x1="1" y1="1" x2="0" y2="0"><stop stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#e4e4e7" /></linearGradient></defs>
        </svg>
        <svg className="ss-orbit-ring" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="0.8" strokeDasharray="1.5 5" />
        </svg>
      </motion.div>

      {/* The tilted orbit is drawn twice: the far half under the mark, the near half over it. No 3D sorting needed. */}
      <motion.div className="ss-orbit-layer" style={{ x: frontX, y: frontY }}>
        <div className="ss-orbit-half ss-orbit-far"><Plane /></div>
        <div className="ss-orbit-mark">{children}</div>
        <div className="ss-orbit-half ss-orbit-near"><Plane /></div>
      </motion.div>
    </div>
  );
}
