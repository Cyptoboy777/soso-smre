"use client";

import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";
import styles from "./SoDoggy.module.css";

type Props = {
  speaking: boolean;
  size?: number;
  emotion?: string;
};

const COLOR_MAP: Record<string, string> = {
  excited: "#f59e0b",
  happy:   "#2bd9a8",
  alert:   "#ff1744",
  sad:     "#3b82f6",
  neutral: "#00e5ff",
};

export default function SoDoggyAvatar({ speaking, size = 90, emotion = "neutral" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 200, damping: 20 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 200, damping: 20 });

  const tc = COLOR_MAP[emotion] || COLOR_MAP.neutral;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top)  / rect.height - 0.5);
  };
  const handleMouseLeave = () => { mx.set(0); my.set(0); };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: size, height: size, position: "relative", perspective: 600 }}
    >
      <motion.div
        style={{ width: "100%", height: "100%", position: "relative", rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        animate={{ y: speaking ? [0, -5, 0] : [0, -3, 0] }}
        transition={{ repeat: Infinity, duration: speaking ? 0.25 : 3, ease: "easeInOut" }}
      >
        {/* ── Outer Glow Aura ── */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.35, 0.15] }}
          transition={{ repeat: Infinity, duration: 3 }}
          style={{
            position: "absolute", inset: -size * 0.3,
            background: `radial-gradient(circle, ${tc}33 0%, transparent 70%)`,
            borderRadius: "50%", pointerEvents: "none",
          }}
        />

        {/* ── Orbital Ring 1 — slow ── */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
          style={{
            position: "absolute", inset: -size * 0.12,
            border: `1px solid ${tc}50`,
            borderTopColor: tc,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        {/* ── Orbital Ring 2 — fast reverse ── */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
          style={{
            position: "absolute", inset: -size * 0.04,
            border: `1px dashed ${tc}30`,
            borderBottomColor: `${tc}90`,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        {/* ── Floating Particles ── */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0, 1, 0],
              y: [0, -(size * 0.8)],
              x: [0, (i % 2 === 0 ? 1 : -1) * (size * 0.3) * Math.random()],
              scale: [0.5, 1.2, 0],
            }}
            transition={{ repeat: Infinity, duration: 2.5 + i * 0.3, delay: i * 0.4, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: "55%", left: `${20 + i * 8}%`,
              width: 3, height: 3,
              background: tc,
              borderRadius: "50%",
              boxShadow: `0 0 6px ${tc}`,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* ── Holographic Scan Line ── */}
        <motion.div
          animate={{ y: ["0%", "100%", "0%"], opacity: [0, 0.6, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
          style={{
            position: "absolute", left: 0, right: 0, top: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${tc}, transparent)`,
            pointerEvents: "none", zIndex: 10,
            filter: `blur(1px)`,
          }}
        />

        {/* ── Base Doggy PNG ── */}
        <motion.img
          src="/doggy/base.png"
          alt="SoDoggy"
          animate={{
            filter: speaking
              ? [`drop-shadow(0 0 12px ${tc})`, `drop-shadow(0 0 24px ${tc})`, `drop-shadow(0 0 12px ${tc})`]
              : [`drop-shadow(0 0 8px ${tc}60)`, `drop-shadow(0 0 14px ${tc}80)`, `drop-shadow(0 0 8px ${tc}60)`],
          }}
          transition={{ repeat: Infinity, duration: speaking ? 0.4 : 2.5 }}
          style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 2 }}
        />

        {/* ── Voice Pulse Rings ── */}
        <AnimatePresence>
          {speaking && [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.35 }}
              style={{
                position: "absolute", inset: 0,
                border: `2px solid ${tc}`,
                borderRadius: "50%",
                pointerEvents: "none", zIndex: 1,
              }}
            />
          ))}
        </AnimatePresence>

        {/* ── Emotion Indicator Dot ── */}
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            position: "absolute", bottom: size * 0.05, right: size * 0.05,
            width: size * 0.12, height: size * 0.12,
            background: tc,
            borderRadius: "50%",
            boxShadow: `0 0 10px ${tc}, 0 0 20px ${tc}50`,
            border: "2px solid rgba(0,0,0,0.5)",
            zIndex: 5,
          }}
        />
      </motion.div>
    </div>
  );
}
