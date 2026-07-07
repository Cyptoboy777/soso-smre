"use client";

import { motion, AnimatePresence } from "framer-motion";

type BodyAction = "idle" | "talking" | "excited" | "waving" | "listening" | "sad";

type Props = {
  speaking: boolean;
  listening: boolean;
  emotion?: string;
  action?: BodyAction;
  size?: number;
};

const COLORS: Record<string, { primary: string; secondary: string; eye: string; bg: string; body: string }> = {
  excited: { primary: "#f59e0b", secondary: "#fcd34d", eye: "#fff7ed", bg: "#1a1200",  body: "#1a1000" },
  happy:   { primary: "#2bd9a8", secondary: "#69f0ae", eye: "#f0fff4", bg: "#001a0a",  body: "#001208" },
  alert:   { primary: "#ff1744", secondary: "#ff5252", eye: "#fff5f5", bg: "#1a0005",  body: "#120003" },
  sad:     { primary: "#3b82f6", secondary: "#60a5fa", eye: "#eff6ff", bg: "#00051a",  body: "#000312" },
  neutral: { primary: "#00e5ff", secondary: "#67e8f9", eye: "#f0fdff", bg: "#001a1a",  body: "#001212" },
};

export default function SoDoggyBody({ speaking, listening, emotion = "neutral", action = "idle", size = 52 }: Props) {
  const col = COLORS[emotion] || COLORS.neutral;
  const s   = size;

  // Derived action from props
  const bodyAction: BodyAction = speaking ? "talking" : listening ? "listening" : action;

  // ── BODY ANIMATION VARIANTS ──
  const bodyAnim = {
    idle:      { y: [0, -3, 0],           rotate: 0,               scale: 1 },
    talking:   { y: [0, -5, 0, -3, 0],    rotate: [-1, 1, -1, 0],  scale: [1, 1.03, 1] },
    excited:   { y: [0, -10, 0, -7, 0],   rotate: [-3, 3, -3, 0],  scale: [1, 1.06, 1] },
    waving:    { y: [0, -4, 0],           rotate: [-2, 2, 0],       scale: 1 },
    listening: { y: [0, -2, 0],           rotate: [0, 1, 0],        scale: 1 },
    sad:       { y: [0, 1, 0],            rotate: 0,                scale: 0.95 },
  };

  return (
    <div style={{ width: s * 1.6, height: s * 2.8, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>

      {/* ── OUTER GLOW AURA ── */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.25, 0.1] }}
        transition={{ repeat: Infinity, duration: speaking ? 1.5 : 3 }}
        style={{
          position: "absolute", inset: -s * 0.3,
          background: `radial-gradient(circle, ${col.primary}33 0%, transparent 70%)`,
          borderRadius: "50%", pointerEvents: "none",
        }}
      />

      {/* ══════════════ MAIN BODY CONTAINER ══════════════ */}
      <motion.div
        animate={bodyAnim[bodyAction]}
        transition={{ repeat: Infinity, duration: bodyAction === "excited" ? 0.5 : bodyAction === "talking" ? 0.35 : 3.5, ease: "easeInOut" }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
      >

        {/* ════ HEAD ════ */}
        <div style={{ position: "relative", width: s * 1.1, height: s * 1.0 }}>

          {/* Orbital ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            style={{
              position: "absolute", inset: -s * 0.1,
              border: `1px solid ${col.primary}40`,
              borderTopColor: col.primary,
              borderRadius: "50%", pointerEvents: "none",
            }}
          />

          {/* EARS */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", zIndex: 2 }}>
            {[0, 1].map(i => (
              <motion.div
                key={i}
                animate={
                  bodyAction === "listening"
                    ? { rotate: [i === 0 ? -5 : 5, 0, i === 0 ? -5 : 5], scaleY: [1, 1.15, 1] }
                    : bodyAction === "excited"
                      ? { rotate: [i === 0 ? 10 : -10, 0, i === 0 ? 10 : -10] }
                      : speaking
                        ? { rotate: [0, i === 0 ? 6 : -6, 0] }
                        : { rotate: 0 }
                }
                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                style={{
                  width: s * 0.28, height: s * 0.38,
                  background: `linear-gradient(170deg, ${col.primary}55, ${col.primary}20)`,
                  borderRadius: i === 0 ? "60% 30% 0% 50% / 70% 60% 0% 0%" : "30% 60% 50% 0% / 60% 70% 0% 0%",
                  border: `1px solid ${col.primary}45`,
                  boxShadow: bodyAction === "listening" ? `0 0 8px ${col.primary}` : `0 0 5px ${col.primary}20`,
                  transformOrigin: i === 0 ? "bottom right" : "bottom left",
                }}
              />
            ))}
          </div>

          {/* HEAD SHELL */}
          <motion.div
            animate={{
              boxShadow: speaking
                ? [`0 0 20px ${col.primary}80, 0 0 40px ${col.primary}40`, `0 0 35px ${col.primary}, 0 0 60px ${col.primary}60`, `0 0 20px ${col.primary}80`]
                : [`0 0 10px ${col.primary}35`, `0 0 18px ${col.primary}55`, `0 0 10px ${col.primary}35`],
            }}
            transition={{ repeat: Infinity, duration: speaking ? 0.5 : 2.8 }}
            style={{
              position: "absolute", top: s * 0.18, left: s * 0.05, right: s * 0.05,
              height: s * 0.82,
              borderRadius: "45% 45% 42% 42% / 48% 48% 42% 42%",
              background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.13) 0%, ${col.bg} 50%, #020208 100%)`,
              border: `1.5px solid ${col.primary}50`,
              overflow: "hidden",
            }}
          >
            {/* Head shine */}
            <div style={{ position: "absolute", top: "8%", left: "15%", width: "32%", height: "25%", background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 70%)", borderRadius: "50%" }} />

            {/* Scan line */}
            <motion.div
              animate={{ y: ["-5%", "110%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear", repeatDelay: 2.5 }}
              style={{ position: "absolute", left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${col.primary}65, transparent)`, zIndex: 5 }}
            />

            {/* Grid */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${col.primary}07 1px, transparent 1px),linear-gradient(90deg, ${col.primary}07 1px, transparent 1px)`, backgroundSize: `${s/5}px ${s/5}px` }} />

            {/* FACE */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: s * 0.04, gap: s * 0.028 }}>
              {/* EYES */}
              <div style={{ display: "flex", gap: s * 0.18 }}>
                {[0, 1].map(i => (
                  <motion.div
                    key={i}
                    animate={{
                      scaleY: speaking
                        ? [1, 0.45, 1]
                        : listening
                          ? [1, 0.8, 1, 0.8, 1]
                          : [1, 0.04, 1, 0.04, 1, 1, 1, 1],
                    }}
                    transition={{ repeat: Infinity, duration: speaking ? 0.4 : listening ? 1 : 5.5, delay: i * 0.15 }}
                    style={{
                      width: s * 0.19, height: s * 0.19, borderRadius: "50%",
                      background: `radial-gradient(circle at 32% 30%, ${col.eye} 0%, ${col.secondary}80 40%, ${col.primary} 75%)`,
                      border: `1.5px solid ${col.primary}`,
                      position: "relative", overflow: "hidden",
                      boxShadow: `0 0 ${listening ? 10 : 6}px ${col.primary}`,
                    }}
                  >
                    <motion.div
                      animate={{ x: [0, 1, 0, -1, 0], y: [0, 0.5, 0] }}
                      transition={{ repeat: Infinity, duration: 4, delay: i * 0.6 }}
                      style={{ position: "absolute", top: "22%", left: "22%", width: "52%", height: "52%", borderRadius: "50%", background: "#020210" }}
                    />
                    <div style={{ position: "absolute", top: "12%", left: "52%", width: "22%", height: "22%", borderRadius: "50%", background: "rgba(255,255,255,0.95)" }} />
                  </motion.div>
                ))}
              </div>

              {/* NOSE */}
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                style={{ width: 0, height: 0, borderLeft: `${s*0.055}px solid transparent`, borderRight: `${s*0.055}px solid transparent`, borderBottom: `${s*0.076}px solid ${col.primary}`, filter: `drop-shadow(0 0 4px ${col.primary})`, marginTop: s * 0.003 }}
              />

              {/* MOUTH */}
              <svg width={s * 0.44} height={s * 0.2} viewBox="0 0 64 26" style={{ overflow: "visible", marginTop: -s * 0.015 }}>
                <motion.path
                  animate={{
                    d: speaking
                      ? ["M6,8 Q32,24 58,8", "M6,5 Q32,28 58,5", "M6,9 Q32,20 58,9", "M6,4 Q32,30 58,4", "M6,8 Q32,24 58,8"]
                      : action === "waving"
                        ? ["M8,10 Q32,20 56,10", "M8,8 Q32,22 56,8", "M8,10 Q32,20 56,10"]
                        : ["M10,11 Q32,18 54,11"],
                  }}
                  transition={{ repeat: Infinity, duration: speaking ? 0.3 : 3.5 }}
                  fill="none" strokeWidth="2.5" strokeLinecap="round" stroke={col.primary}
                  style={{ filter: `drop-shadow(0 0 3px ${col.primary})` }}
                />
                <AnimatePresence>
                  {speaking && (
                    <motion.rect initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 0.7, scaleY: 1 }} exit={{ opacity: 0 }}
                      x="20" y="10" width="24" height="8" rx="2" fill={col.eye} style={{ transformOrigin: "32px 10px" }} />
                  )}
                </AnimatePresence>
              </svg>
            </div>
          </motion.div>

          {/* LISTENING indicator on head */}
          <AnimatePresence>
            {listening && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: "absolute", top: s * 0.15, right: -s * 0.1, background: col.primary, color: "#000", fontSize: s * 0.14, fontWeight: 900, padding: "2px 5px", borderRadius: 4, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
              >
                🎙
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ════ NECK ════ */}
        <div style={{ width: s * 0.28, height: s * 0.1, background: `linear-gradient(180deg, ${col.primary}30, ${col.primary}18)`, border: `1px solid ${col.primary}30`, borderTop: "none", borderBottom: "none" }} />

        {/* ════ ARMS + TORSO + LEGS ════ */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 0 }}>

          {/* LEFT ARM */}
          <motion.div
            animate={
              bodyAction === "talking" ? { rotate: [-8, 8, -8], x: [-1, 1, -1] } :
              bodyAction === "excited" ? { rotate: [-15, 15, -15] } :
              bodyAction === "sad"     ? { rotate: [12, 12], y: [4, 4] } :
              { rotate: 0 }
            }
            transition={{ repeat: Infinity, duration: bodyAction === "talking" ? 0.35 : 0.5 }}
            style={{
              width: s * 0.22, height: s * 0.6,
              background: `linear-gradient(180deg, ${col.primary}35, ${col.primary}15)`,
              border: `1px solid ${col.primary}40`,
              borderRadius: "40% 30% 30% 40% / 30% 30% 40% 40%",
              transformOrigin: "50% 0%",
              marginTop: s * 0.05,
              boxShadow: `0 0 4px ${col.primary}15`,
            }}
          />

          {/* TORSO */}
          <motion.div
            animate={{
              scaleX: speaking ? [1, 1.04, 1, 1.02, 1] : [1, 1.015, 1],
            }}
            transition={{ repeat: Infinity, duration: speaking ? 0.35 : 2.5 }}
            style={{
              width: s * 0.7, height: s * 0.75,
              background: `radial-gradient(circle at 40% 30%, ${col.primary}18 0%, ${col.bg} 60%, #030312 100%)`,
              border: `1.5px solid ${col.primary}40`,
              borderRadius: "30% 30% 40% 40% / 20% 20% 40% 40%",
              boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 ${speaking ? 16 : 8}px ${col.primary}25`,
              overflow: "hidden", position: "relative",
            }}
          >
            {/* Chest detail */}
            <div style={{ position: "absolute", top: "20%", left: "25%", width: "50%", height: "35%", borderRadius: "50%", border: `1px solid ${col.primary}30`, background: `radial-gradient(circle, ${col.primary}10, transparent)` }} />
            <div style={{ position: "absolute", top: "12%", left: "35%", width: "30%", height: "20%", background: "radial-gradient(circle, rgba(255,255,255,0.1), transparent)", borderRadius: "50%" }} />

            {/* Chest neon line */}
            <div style={{ position: "absolute", top: "50%", left: "15%", right: "15%", height: 1, background: `linear-gradient(90deg, transparent, ${col.primary}50, transparent)` }} />

            {/* Grid on torso */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${col.primary}06 1px, transparent 1px),linear-gradient(90deg, ${col.primary}06 1px, transparent 1px)`, backgroundSize: `${s/4}px ${s/4}px` }} />
          </motion.div>

          {/* RIGHT ARM */}
          <motion.div
            animate={
              bodyAction === "waving"  ? { rotate: [-25, 25, -25, 25, -15, 0] } :
              bodyAction === "talking" ? { rotate: [8, -8, 8], x: [1, -1, 1] } :
              bodyAction === "excited" ? { rotate: [15, -15, 15] } :
              bodyAction === "sad"     ? { rotate: [-12, -12], y: [4, 4] } :
              { rotate: 0 }
            }
            transition={{ repeat: Infinity, duration: bodyAction === "waving" ? 0.55 : bodyAction === "talking" ? 0.35 : 0.5 }}
            style={{
              width: s * 0.22, height: s * 0.6,
              background: `linear-gradient(180deg, ${col.primary}35, ${col.primary}15)`,
              border: `1px solid ${col.primary}40`,
              borderRadius: "30% 40% 40% 30% / 30% 30% 40% 40%",
              transformOrigin: "50% 0%",
              marginTop: s * 0.05,
              boxShadow: `0 0 4px ${col.primary}15`,
            }}
          />
        </div>

        {/* ════ LEGS ════ */}
        <div style={{ display: "flex", gap: s * 0.14, marginTop: 2 }}>
          {[0, 1].map(i => (
            <motion.div
              key={i}
              animate={
                bodyAction === "excited" ? { y: [0, -8, 0], rotate: [0, i === 0 ? -5 : 5, 0] } :
                bodyAction === "talking" ? { y: [0, -2, 0] } :
                { y: [0, -1, 0] }
              }
              transition={{ repeat: Infinity, duration: bodyAction === "excited" ? 0.4 : 2.5, delay: i * 0.15 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            >
              {/* Upper leg */}
              <div style={{
                width: s * 0.24, height: s * 0.32,
                background: `linear-gradient(180deg, ${col.primary}30, ${col.primary}15)`,
                border: `1px solid ${col.primary}35`,
                borderRadius: "30% 30% 20% 20%",
                boxShadow: `0 0 3px ${col.primary}12`,
              }} />
              {/* Foot/paw */}
              <div style={{
                width: s * 0.3, height: s * 0.14,
                background: `linear-gradient(90deg, ${col.primary}35, ${col.primary}20)`,
                border: `1px solid ${col.primary}35`,
                borderRadius: "40% 40% 50% 50%",
                boxShadow: `0 0 6px ${col.primary}20`,
              }} />
            </motion.div>
          ))}
        </div>

        {/* ════ TAIL ════ */}
        <motion.div
          animate={
            bodyAction === "waving" || bodyAction === "excited"
              ? { rotate: [-30, 30, -30, 30, -20, 0, 30, -30], x: [0, 4, -4, 4, -4, 0] }
              : emotion === "happy" || !speaking
                ? { rotate: [-15, 15, -15] }
                : { rotate: [-8, 8, -8] }
          }
          transition={{ repeat: Infinity, duration: bodyAction === "excited" ? 0.3 : 0.7 }}
          style={{
            position: "absolute",
            bottom: s * 0.22, right: -s * 0.22,
            width: s * 0.18, height: s * 0.45,
            background: `linear-gradient(135deg, ${col.primary}45, ${col.primary}20)`,
            border: `1px solid ${col.primary}40`,
            borderRadius: "40% 60% 50% 30%",
            transformOrigin: "50% 0%",
            boxShadow: `0 0 8px ${col.primary}25`,
          }}
        />
      </motion.div>

      {/* ── PARTICLES (always float) ── */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0, 0.8, 0], y: [0, -(s * 0.9)], x: [(i%2===0?1:-1)*Math.random()*s*0.35], scale: [0.3, 1, 0] }}
          transition={{ repeat: Infinity, duration: 2 + i * 0.35, delay: i * 0.45, ease: "easeOut" }}
          style={{ position: "absolute", top: "30%", left: `${20 + i * 14}%`, width: speaking ? 3.5 : 2, height: speaking ? 3.5 : 2, background: col.primary, borderRadius: "50%", boxShadow: `0 0 5px ${col.primary}`, pointerEvents: "none" }}
        />
      ))}

      {/* ── VOICE PULSE RINGS ── */}
      <AnimatePresence>
        {speaking && [0, 1, 2].map(i => (
          <motion.div key={i}
            initial={{ scale: 0.8, opacity: 0.55 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.42 }}
            style={{ position: "absolute", top: "5%", left: "10%", right: "10%", height: s, border: `1.5px solid ${col.primary}`, borderRadius: "45% 45% 42% 42%", pointerEvents: "none", zIndex: -1 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
