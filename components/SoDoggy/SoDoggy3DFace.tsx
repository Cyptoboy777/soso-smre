"use client";

import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";

type Props = {
  speaking: boolean;
  size?: number;
  emotion?: string;
  isWaving?: boolean;
};

const COLORS: Record<string, { primary: string; secondary: string; eye: string; bg: string }> = {
  excited: { primary: "#f59e0b", secondary: "#fcd34d", eye: "#fff7ed", bg: "#1a1000" },
  happy:   { primary: "#00e676", secondary: "#69f0ae", eye: "#f0fff4", bg: "#001a0a" },
  alert:   { primary: "#ff1744", secondary: "#ff5252", eye: "#fff5f5", bg: "#1a0005" },
  sad:     { primary: "#3b82f6", secondary: "#60a5fa", eye: "#eff6ff", bg: "#00051a" },
  neutral: { primary: "#00e5ff", secondary: "#67e8f9", eye: "#f0fdff", bg: "#001a1a" },
};

export default function SoDoggy3DFace({ speaking, size = 56, emotion = "neutral", isWaving = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [14, -14]), { stiffness: 200, damping: 22 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-16, 16]), { stiffness: 200, damping: 22 });

  const col = COLORS[emotion] || COLORS.neutral;
  const s = size;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top)  / r.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ width: s, height: s + s * 0.2, position: "relative", perspective: 500 }}
    >
      {/* ── OUTER AURA ── */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.12, 0.3, 0.12] }}
        transition={{ repeat: Infinity, duration: speaking ? 1.5 : 3.5 }}
        style={{
          position: "absolute", inset: -s * 0.28,
          background: `radial-gradient(circle, ${col.primary}44 0%, transparent 70%)`,
          borderRadius: "50%", pointerEvents: "none",
        }}
      />

      {/* ── BODY (wave motion container) ── */}
      <motion.div
        animate={isWaving
          ? { rotate: [0, -8, 8, -8, 8, -5, 0], y: [0, -4, 0] }
          : { y: speaking ? [0, -4, 0, -3, 0] : [0, -2, 0] }
        }
        transition={{
          repeat: Infinity,
          duration: isWaving ? 0.7 : (speaking ? 0.35 : 4),
          ease: "easeInOut",
        }}
        style={{ width: "100%", height: "100%", position: "relative" }}
      >

        {/* ── ORBITAL RINGS ── */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 9, ease: "linear" }}
          style={{
            position: "absolute", inset: -s * 0.1,
            border: `1px solid ${col.primary}55`,
            borderTopColor: col.primary,
            borderRadius: "50%", pointerEvents: "none",
          }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 5.5, ease: "linear" }}
          style={{
            position: "absolute", inset: -s * 0.02,
            border: `1px dashed ${col.primary}25`,
            borderBottomColor: `${col.primary}80`,
            borderRadius: "50%", pointerEvents: "none",
          }}
        />

        {/* ── 3D HEAD (perspective tilt) ── */}
        <motion.div
          style={{
            width: "100%", height: s, // head portion
            rotateX: rotX, rotateY: rotY,
            transformStyle: "preserve-3d",
            position: "relative",
          }}
        >
          {/* ── EARS ── */}
          <div style={{ position: "absolute", top: s * 0.04, left: 0, right: 0, display: "flex", justifyContent: "space-between", zIndex: 1 }}>
            {[0, 1].map(i => (
              <motion.div
                key={i}
                animate={speaking
                  ? { rotate: [0, i === 0 ? 8 : -8, 0] }
                  : isWaving
                    ? { rotate: [0, i === 0 ? 12 : -12, 0] }
                    : { rotate: 0 }
                }
                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                style={{
                  width: s * 0.21, height: s * 0.3,
                  background: `linear-gradient(170deg, ${col.primary}50, ${col.primary}20)`,
                  borderRadius: i === 0 ? "60% 30% 0% 50% / 70% 60% 0% 0%" : "30% 60% 50% 0% / 60% 70% 0% 0%",
                  border: `1px solid ${col.primary}50`,
                  boxShadow: `0 0 6px ${col.primary}25`,
                  transformOrigin: i === 0 ? "bottom right" : "bottom left",
                }}
              />
            ))}
          </div>

          {/* ── HEAD SHELL ── */}
          <motion.div
            animate={{
              boxShadow: speaking
                ? [`0 0 25px ${col.primary}90, 0 0 50px ${col.primary}50, inset 0 0 20px ${col.primary}30`,
                   `0 0 40px ${col.primary}, 0 0 70px ${col.primary}70, inset 0 0 35px ${col.primary}50`,
                   `0 0 25px ${col.primary}90, 0 0 50px ${col.primary}50, inset 0 0 20px ${col.primary}30`]
                : [`0 0 12px ${col.primary}40`, `0 0 20px ${col.primary}60`, `0 0 12px ${col.primary}40`],
            }}
            transition={{ repeat: Infinity, duration: speaking ? 0.5 : 2.8 }}
            style={{
              position: "absolute", top: s * 0.12, left: 0, right: 0,
              height: s * 0.88,
              borderRadius: "46% 46% 44% 44% / 50% 50% 44% 44%",
              background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.14) 0%, ${col.bg} 55%, #020208 100%)`,
              border: `1.5px solid ${col.primary}55`,
              overflow: "hidden",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Top light shine */}
            <div style={{
              position: "absolute", top: "8%", left: "15%",
              width: "35%", height: "26%",
              background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
              borderRadius: "50%",
            }} />

            {/* Scan line */}
            <motion.div
              animate={{ y: ["-5%", "110%"] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "linear", repeatDelay: 2 }}
              style={{
                position: "absolute", left: 0, right: 0, height: 1,
                background: `linear-gradient(90deg, transparent, ${col.primary}70, transparent)`,
                pointerEvents: "none", zIndex: 8,
              }}
            />

            {/* Cyber grid */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: `linear-gradient(${col.primary}08 1px, transparent 1px), linear-gradient(90deg, ${col.primary}08 1px, transparent 1px)`,
              backgroundSize: `${s / 5}px ${s / 5}px`,
              pointerEvents: "none",
            }} />

            {/* ── FACE CONTENT ── */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              paddingTop: s * 0.06,
              gap: s * 0.035,
            }}>
              {/* EYES */}
              <div style={{ display: "flex", gap: s * 0.19, alignItems: "center" }}>
                {[0, 1].map(i => (
                  <motion.div
                    key={i}
                    animate={{
                      scaleY: speaking ? [1, 0.5, 1] : [1, 0.04, 1, 0.04, 1, 1, 1, 1],
                      boxShadow: [
                        `0 0 6px ${col.primary}, 0 0 12px ${col.primary}60`,
                        `0 0 10px ${col.primary}, 0 0 22px ${col.primary}80`,
                        `0 0 6px ${col.primary}, 0 0 12px ${col.primary}60`,
                      ],
                    }}
                    transition={{
                      scaleY: { repeat: Infinity, duration: speaking ? 0.45 : 5.5, delay: speaking ? i * 0.12 : i * 0.25 },
                      boxShadow: { repeat: Infinity, duration: 2.2 },
                    }}
                    style={{
                      width: s * 0.18, height: s * 0.18,
                      borderRadius: "50%",
                      background: `radial-gradient(circle at 32% 30%, ${col.eye} 0%, ${col.secondary}80 45%, ${col.primary} 75%)`,
                      border: `1.5px solid ${col.primary}`,
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {/* Pupil */}
                    <motion.div
                      animate={{ x: [0, 1, 0, -1, 0], y: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 4, delay: i * 0.5 }}
                      style={{
                        position: "absolute", top: "22%", left: "22%",
                        width: "52%", height: "52%",
                        borderRadius: "50%", background: "#030310",
                      }}
                    />
                    {/* Shine */}
                    <div style={{
                      position: "absolute", top: "12%", left: "52%",
                      width: "22%", height: "22%",
                      borderRadius: "50%", background: "rgba(255,255,255,0.95)",
                    }} />
                  </motion.div>
                ))}
              </div>

              {/* NOSE */}
              <motion.div
                animate={{ opacity: [0.65, 1, 0.65], scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                style={{
                  width: 0, height: 0,
                  borderLeft: `${s * 0.058}px solid transparent`,
                  borderRight: `${s * 0.058}px solid transparent`,
                  borderBottom: `${s * 0.08}px solid ${col.primary}`,
                  filter: `drop-shadow(0 0 4px ${col.primary})`,
                  marginTop: s * 0.005,
                }}
              />

              {/* MOUTH */}
              <motion.svg
                width={s * 0.44} height={s * 0.22}
                viewBox="0 0 64 26"
                style={{ overflow: "visible", marginTop: -s * 0.01 }}
              >
                <motion.path
                  animate={{
                    d: speaking
                      ? ["M6,8 Q32,24 58,8", "M6,5 Q32,28 58,5", "M6,9 Q32,20 58,9", "M6,4 Q32,30 58,4", "M6,8 Q32,24 58,8"]
                      : isWaving
                        ? ["M8,10 Q32,22 56,10", "M8,8 Q32,24 56,8", "M8,10 Q32,22 56,10"]
                        : ["M10,11 Q32,19 54,11"],
                    stroke: [col.primary, col.secondary, col.primary],
                  }}
                  transition={{ repeat: Infinity, duration: speaking ? 0.32 : isWaving ? 0.6 : 3.5 }}
                  fill="none" strokeWidth="2.5" strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 3px ${col.primary})` }}
                />
                {/* Teeth */}
                <AnimatePresence>
                  {speaking && (
                    <motion.rect
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 0.75, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      x="20" y="10" width="24" height="8" rx="2"
                      fill={col.eye}
                      style={{ transformOrigin: "32px 10px" }}
                    />
                  )}
                </AnimatePresence>
              </motion.svg>
            </div>
          </motion.div>

          {/* ── WAVING ARM (appears when waving) ── */}
          <AnimatePresence>
            {isWaving && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                style={{ position: "absolute", right: -s * 0.32, top: s * 0.3 }}
              >
                <motion.div
                  animate={{ rotate: [-20, 20, -20, 20, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  style={{
                    width: s * 0.28, height: s * 0.55,
                    background: `linear-gradient(180deg, ${col.primary}40, ${col.primary}20)`,
                    borderRadius: "50% 50% 40% 40%",
                    border: `1px solid ${col.primary}50`,
                    transformOrigin: "50% 0%",
                    boxShadow: `0 0 8px ${col.primary}30`,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── PARTICLES ── */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0, 0.85, 0],
              y: [0, -(s * 0.95)],
              x: [(i % 2 === 0 ? 1 : -1) * Math.random() * s * 0.38],
              scale: [0.3, 1, 0],
            }}
            transition={{ repeat: Infinity, duration: 2 + i * 0.3, delay: i * 0.4, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: "65%", left: `${12 + i * 13}%`,
              width: speaking ? 4 : 2.5, height: speaking ? 4 : 2.5,
              background: col.primary, borderRadius: "50%",
              boxShadow: `0 0 5px ${col.primary}`,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* ── VOICE PULSE RINGS ── */}
        <AnimatePresence>
          {speaking && [0, 1, 2].map(i => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.42 }}
              style={{
                position: "absolute", top: s * 0.12, left: 0,
                width: "100%", height: s * 0.88,
                border: `1.5px solid ${col.primary}`,
                borderRadius: "46% 46% 44% 44%",
                pointerEvents: "none", zIndex: -1,
              }}
            />
          ))}
        </AnimatePresence>

        {/* ── EMOTION DOT ── */}
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          style={{
            position: "absolute", bottom: s * 0.02, right: s * 0.04,
            width: s * 0.12, height: s * 0.12,
            background: col.primary,
            borderRadius: "50%",
            boxShadow: `0 0 8px ${col.primary}, 0 0 16px ${col.primary}50`,
            border: "1.5px solid rgba(0,0,0,0.5)",
            zIndex: 5,
          }}
        />
      </motion.div>
    </div>
  );
}
