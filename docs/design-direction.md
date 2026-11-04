# FlowSentinel design direction (Builder Race v2)

**Date:** 2026-11-04 (Asia/Calcutta)  
**Goal:** Coolest, smoothest, easiest SoSoValue Builder Race app. Original composition; inspiration only.

## 1. Research notes (licences)

| Source | Stars / role | Licence | Use |
|--------|--------------|---------|-----|
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Accessible primitives / patterns | MIT | Structure: focus rings, quiet surfaces, copy-paste patterns (adapted, not vendored wholesale) |
| [Magic UI](https://github.com/magicuidesign/magicui) | Motion flourishes | MIT | Soft border glow, staggered entrances (adapted) |
| [Origin UI](https://github.com/origin-space/originui) / shadcn fork | App UI blocks | MIT | Card / toolbar density ideas |
| [Tremor](https://github.com/tremorlabs/tremor) | Charts / KPI | Apache-2.0 | KPI strip + chart framing (own chart code kept) |
| Radix Themes / primitives | A11y behaviours | MIT | Focus, dialog, toggle semantics via next-themes + native controls |
| Vercel Geist guidelines | Product polish | MIT (Geist font) | Restraint, density, tabular nums; keep Inter Tight + JetBrains Mono already loaded |
| Motion (Framer Motion) | Already in repo | MIT | 150–400ms panel/hover; 500–900ms hero; respect `prefers-reduced-motion` |
| R3F + drei | Already in repo | MIT | Hero orb / flow field only; chat uses CSS 3D orb for perf |
| Aceternity UI | Effects | **Not MIT** (no redistribute of component source) | **Do not vendor**; inspire only |

**Crypto / fintech UX patterns (inspiration, no assets copied)**  
- **Phantom:** calm consumer UI, plain language, hide chain/signing jargon, progressive disclosure.  
- **Rainbow:** delightful micro-motion, colour as status, card clarity.  
- **Uniswap:** one primary action, minimal inputs, system / light / dark themes.  
- **Hyperliquid:** hierarchy for dense data without looking like a terminal dump.

## 2. Design contract

| | |
|--|--|
| **Thesis** | FlowSentinel turns SoSoValue market news into a clear idea and a practice trade you confirm yourself. |
| **World** | Warm forge desk: charcoal + soft paper dawn, SoSoValue flame as the only heat. |
| **Story** | Watch → Idea → Check risk → You confirm. |
| **First viewport** | Quiet hero: one benefit headline, soft 3D orb, four plain steps, no internal IDs. |
| **Signature** | Flame AI orb + anchored chat assistant (never places orders). |
| **Risk to avoid** | Neon crypto dashboard, purple AI gradients, Wave/buildathon badges, model names, EIP-712 / key pills. |

## 3. Visual system

### Palette (brand locked)

| Token | Dark | Light | Notes |
|-------|------|-------|-------|
| `--bg` | `#0B0A09` | `#FFF8F5` | Warm void / warm paper |
| `--surface-1` | `#141210` | `#FFFFFF` | Cards |
| `--surface-2` | `#1C1917` | `#FFF1EB` | Nested / chips |
| `--line` | `white 9%` | `#7F2711` 12% | Hairlines |
| `--text` | `#FAF7F5` | `#1A1210` | Body ≥ 4.5:1 |
| `--text-muted` | `#A8A29E` | `#5C4A44` | AA muted |
| `--accent` | `#FF4F20` | `#E6451A` | SoSoValue flame (darker in light for AA on white) |
| `--accent-soft` | `#FF7637` | `#C45320` | SoDEX orange |
| `--gain` / `--loss` | `#1EA858` / `#F24237` | same | Status |

### Type
- **Sans:** Inter Tight (display + UI)  
- **Mono:** JetBrains Mono (prices, IDs on track-record only)  
- Fluid display `clamp(2rem, 5vw, 3.25rem)`; body ≥ 16px; sentence case only.

### Motion
- Press 120ms, hover 180ms, panels 280ms, hero entrance ≤ 700ms.  
- Expo-out entrances; exits ~30% faster.  
- Orb: gentle idle float; pause when reduced-motion.  
- No layout thrash; transform/opacity only.

### Layout
- **Home:** Shell → Hero (benefit + orb + 4 steps) → Desk idea card → briefing → data.  
- **Idea card:** Direction as Bullish / Bearish / Neutral; hide levels when no setup.  
- **Chat:** Fixed bottom-right; backdrop when open; launcher orb ≥ 64px.  
- **Stats / Track record:** Clean KPI panels; order proof + explorer-style links only on `/track-record`.  
- **Themes:** `next-themes` class strategy, system default, `fs-theme`, no flash.

## 4. Copy rules
- No em dashes in UI (all locales).  
- No Gemini / Rules / EIP-712 / Live key / order IDs on home.  
- Friendly: Practice mode, Powered by SoSoValue data, You confirm every order.

## 5. Verification bar
- axe: 0 colour-contrast violations dark + light on home, desk, chat, stats, track-record.  
- Lighthouse a11y ≥ 95 target; tsc / vitest / build green.  
- Screenshots: home desktop+mobile, desk/idea, chat open, stats, track-record × dark+light → `/workspace/buildathons/sosovalue/screens/`.

## 6. Explicit non-goals
- Do not merge to Production; mainnet stays off; no new secrets/keys.  
- Do not copy Phantom/Rainbow/Uniswap branding or assets.  
- Do not vendor Aceternity source.
