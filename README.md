<p align="center">
  <img src="public/cybonk_dog.png" alt="SoDoggy — SOSO SMRE AI Mascot" width="120" />
</p>

<h1 align="center">SOSO SMRE ⚡ Wave 3 Final Edition</h1>
<h3 align="center">Smart Money Research Engine — SoSoValue Buildathon Grand Finale Build</h3>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/Cyptoboy777/soso-smre"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
  &nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/SoDEX-Live%20WebSocket-green" />
  <img src="https://img.shields.io/badge/Wagmi-Web3%20Ready-blue" />
  <img src="https://img.shields.io/badge/Gemini%202.5%20Flash-AI%20Powered-purple?logo=google" />
  <img src="https://img.shields.io/badge/Signed%20%26%20Rate--Limited-Trade%20Execution-red" />
</p>

<p align="center">
  <b>🌍 Live Demo: <a href="https://soso-smre.vercel.app/login">https://soso-smre.vercel.app/login</a></b><br/>
  <i>Connect your Web3 wallet and experience the autonomous, relayerless execution workspace.</i>
</p>

---

# Updates in this Wave ⚡ Wave 3 Final Edition
🏆 Wave 2 → Wave 3 = superset — now hardened for production, not just a demo.
**Live Portal:** [https://soso-smre.vercel.app](https://soso-smre.vercel.app/login)
**Repo:** [https://github.com/Cyptoboy777/soso-smre](https://github.com/Cyptoboy777/soso-smre)
**Release:** [https://github.com/Cyptoboy777/soso-smre/releases/tag/wave-3-final](https://github.com/Cyptoboy777/soso-smre/releases/tag/wave-3-final)

---

## Why judges should care

Most buildathon trading terminals stop at "it renders and the demo works." SOSO SMRE goes one layer deeper: every path that touches money, an external API, or a public leaderboard is **signed, verified, rate-limited, and server-derived** — not just wired up and trusted. That distinction is deliberate and it's everywhere in this codebase:

- **Real-money trades require a verified signature.** `/api/trade` reconstructs the exact EIP-712 payload the wallet signed and calls `viem.verifyTypedData` before it will touch the SoDEX matching engine in `mode: "real"` — a request without a valid signature is rejected with `401`, full stop.
- **Wallet "login" is actually verified, not just claimed.** Connecting a wallet signs a challenge message; the signature is verified with `viem.verifyMessage` both at connect time and again on every session restore, so a spoofed `localStorage` value can't impersonate an address.
- **The leaderboard and "Proof of PnL" card show real numbers.** `/api/portfolio` replays each account's trade log server-side to derive holdings, cash balance, and P&L — it doesn't trust whatever the client sends. The public leaderboard reads from a dedicated Firestore collection ranked by a server-computed score, with mock data shown only as an empty-state fallback, never silently substituted for real rankings.
- **Every external-facing endpoint is rate-limited and validated.** Trade execution, Telegram alerts, and the SoDEX market-data proxy all check input shape (numeric chat IDs, an explicit endpoint allowlist, positive amounts) and enforce per-IP request limits before doing any real work.

None of this is decorative — it's the difference between a terminal you'd actually trust with a connected wallet and one that only looks like it.

---

## 🔌 API Integrations: How We Utilized SoDEX & SoSoValue

Our system integrates directly with mainnet data endpoints and Web3 execution APIs to drive the terminal:

### 🔴 1. SoDEX API Integration (Live Execution & Orderbook Websockets)
* **Websocket Connections:** Connects to `wss://` SoDEX streams to ingest real-time ticks, orderbook spreads, and matching logs. These feeds are written to a global Zustand cache (`sodexStore.ts`) to drive the TradingView charts.
* **On-Chain Orders:** Leverages the user's Web3 wallet connection via Wagmi to write directly to the SoDEX Router smart contract address on-chain (`0x378BcADaBfF12530E57223b207aA6Fd4b93b4822`), prompting wallets to sign transactions.
* **Relayer Signatures:** Uses the `SODEX_API_KEY` and `SODEX_API_SECRET` credentials in Next.js Edge APIs (`/api/trade`) to validate and submit user EIP-712 signed payloads to the matching engine — and the server independently re-verifies that signature against the exact order payload before forwarding it, so the relayer can't be tricked into executing an unsigned order.
* **Market-data proxy allowlist:** `/api/sodex` only forwards a fixed set of known-safe endpoint paths — no arbitrary path pass-through to the upstream host.

### 📊 2. SoSoValue API Integration (Macro Sentiment & ETF Streams)
* **Real-time News Feeds:** Queries SoSoValue news endpoints to fetch real-time macroeconomic bulletins and coin narratives.
* **ETF Inflow Stream:** Pulls net flow statistics (BTC/ETH ETF net inflows) directly into our server middleware.
* **Gemini Pipelines:** Pipes this raw data context into the **SoDoggy sentiment analysis model** (`/api/news/sentiment`) and the **SoEva audio generation script** (`/api/dog-chat`) to produce summaries.

---

## 🏆 Core Philosophy: Why SOSO SMRE?

In modern decentralized finance, retail traders face severe structural barriers that keep them behind institutions:
1. **The Latency Trap:** Classic research terminals display outdated data. In volatile Web3 markets, entering a setup seconds late ruins the risk-to-reward ratio.
2. **The Execution Friction:** Turning a research discovery into a DEX trade requires switching tabs, connecting wallets, calculating sizes, and managing slippage, leading to execution delay.
3. **The Data Silo:** Fundamental news streams (ETF flows, macroeconomic updates), technical chart analysis, and social sentiment are separate, preventing clear decision-making.

**SOSO SMRE** solves these challenges by combining a **real-time SoDEX WebSocket orderbook**, **on-chain direct contract execution (Wagmi v2)**, **NLP-driven autonomous execution triggers**, and **Gemini 2.5 Flash analysis** into a single, high-performance, signature-verified terminal.

---

## ⚙️ System Architecture & Data Flow

```
                      [ SO-VALUE ETF INFLOWS / LIVE NEWS ]
                                      │
                                      ▼
                        [ SODEX LIVE WEBSOCKET DATA FEED ]
                                      │ (sub-second ticks)
                                      ▼
                      ┌────────────────────────────────┐
                      │   Zustand Store (sodexStore)   │ ◄─── Persistent State Cache
                      └──────────────┬─────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
       ┌───────────────────┐                   ┌───────────────────┐
       │   SoDoggy Agent   │                   │ SoEva Pod Studio  │
       │ (Gemini 2.5 NLP)  │                   │ (TTS Speech Node) │
       └─────────┬─────────┘                   └───────────────────┘
                 │
                 ├───────────────────────────────────────┐
                 ▼ (Condition Met)                       ▼ (User Action)
       ┌───────────────────┐                   ┌───────────────────┐
       │  NLP Trigger Core │                   │ Trade Setup Panel │
       └─────────┬─────────┘                   └─────────┬─────────┘
                 │                                       │
                 ▼                                       ▼
       ┌───────────────────────────────────────────────────────────┐
       │              EXECUTION ENGINE — signature-gated            │
       ├───────────────────────────┬───────────────────────────────┤
       │ Relayer Route (EIP-712,   │  Direct Contract Router Write │
       │ server-verified)          │  (Wagmi useWriteContract)     │
       └───────────────────────────┴───────────────────────────────┘
```

---

## ✨ Comprehensive Breakdown of Unique Features

### 🤖 1. Autonomous NLP Trading Engine
* **The Problem:** Traders identify setups but miss entries due to sleep, meetings, or distraction.
* **The Solution:** A natural language processing trigger system inside [`app/ai-trade-agent/page.tsx`](app/ai-trade-agent/page.tsx).
* **Technical Details:**
  * Uses a robust regex NLP utility (`parseNlpTrigger`) to convert user sentences (e.g., *"Buy 100 USDC of SOL if price drops below 140"*) into structured parameters: `symbol`, `type` (`BUY`|`SELL`), `amount`, `conditionType` (`above`|`below`), and `targetPrice`.
  * Every 10 seconds, the engine compares active triggers against live pricing socket updates.
  * When targets are crossed, it autonomously executes a trade payload, updates `localStorage` and **Firestore**, and logs the confirmation in the terminal.

---

### 🛡️ 2. Direct Smart Contract Route (Relayerless Mode)
* **The Problem:** Centralized backend relayers introduce a point of failure, censorship risk, and latency.
* **The Solution:** Fully relayerless, direct smart contract execution in [`components/TradeSetupPanel/TradeSetupPanel.tsx`](components/TradeSetupPanel/TradeSetupPanel.tsx).
* **Technical Details:**
  * Integrates a toggle: `DIRECT CONTRACT` vs `GASLESS RELAYER`.
  * Selecting `DIRECT CONTRACT` utilizes Wagmi v2's `useWriteContract` to submit transactions directly to the SoDEX Router contract address (`0x378BcADaBfF12530E57223b207aA6Fd4b93b4822`), prompting wallets to sign raw on-chain smart contract transactions.
  * Selecting `GASLESS RELAYER` signs a structured EIP-712 `Order` object client-side; the server independently reconstructs that same typed-data struct and calls `viem.verifyTypedData` before ever touching the matching engine.

---

### 🎴 3. Social "Proof of PnL" Card Generator
* **The Problem:** Sharing trading metrics on X or Telegram requires taking screenshots and cropping tables, which are easily faked.
* **The Solution:** A performance card generator inside [`app/portfolio/page.tsx`](app/portfolio/page.tsx), backed by a server-side ledger instead of client-trusted numbers.
* **Technical Details:**
  * `/api/portfolio` replays each account's trade log to derive live holdings, cash balance, and P&L — the numbers on the card are computed server-side from that replay, not read from whatever the client happens to have in `localStorage`.
  * Live ROI, Net Profit, Total Value, and accumulated SoPoints render directly from that server response.
  * Connects directly to X/Twitter intent sharing URLs to publish real, current stats with one click.

---

### 🎙️ 4. AI Podcast Studio (SoEva & Echo)
* **The Problem:** Reading lengthy ETF inflow reports and macro newsletters is time-consuming.
* **The Solution:** An autonomous background audio generation panel inside [`components/SoEva/index.tsx`](components/SoEva/index.tsx).
* **Technical Details:**
  * Ingests real-time ETF inflow metrics and macro news, generating an interactive debate script using Gemini 2.5 Flash.
  * Speaks out the script using localized TTS synthesizers with pause, resume, and emotion indicators.

---

### 📊 5. Backtesting Sandbox
* **The Problem:** Traders want to verify if an AI strategy is profitable before risking capital.
* **The Solution:** Historic simulation workbench inside [`app/backtest/page.tsx`](app/backtest/page.tsx).
* **Technical Details:**
  * Pulls historical market metrics and simulates strategy performance (RSI, Breakouts, Mean Reversion).
  * Renders an interactive line chart showing the counterfactual performance curve versus buy-and-hold strategies.

---

### 🏆 6. Alpha Leaderboard & Podium
* **The Problem:** Social leaderboards are trivial to fake when the client controls its own score.
* **The Solution:** A public, Firestore-backed ranking in [`app/leaderboard/page.tsx`](app/leaderboard/page.tsx) fed by a server-computed score, not a client-submitted one.
* **Technical Details:**
  * `/api/portfolio` computes a `rankPoints` score server-side from the replayed trade log (trade count + realized performance) — the client's own local gamification counter is never used for public ranking.
  * The portfolio page publishes that server-derived score to a public `leaderboard` Firestore collection; `/api/leaderboard` reads and ranks from it directly.
  * The top-3 podium and the full rankings table are driven by the same live data, so they can never disagree with each other.

---

### 📱 7. Telegram Daily Alpha Alerts
* **The Problem:** Traders are away from their screens when market trends shift.
* **The Solution:** Telegram Webhook bot integration configured under [`app/settings/page.tsx`](app/settings/page.tsx).
* **Technical Details:**
  * Sends verified daily market insights and buy/sell alerts directly to the user's Telegram Chat ID.
  * The alert endpoint validates the chat ID format, caps message length, and is rate-limited per IP — it can't be turned into an open spam relay for the bot's identity.

---

## 🔐 Security & Data Integrity

A short list of things most hackathon trading demos skip, that this one doesn't:

| Concern | What we do about it |
|---|---|
| Real-money trade execution | `mode: "real"` orders require a valid EIP-712 signature, verified server-side with `viem.verifyTypedData`, before touching the matching engine |
| Wallet "login" spoofing | Connect flow signs a challenge message; verified with `viem.verifyMessage` on connect **and** on every session restore |
| Fake leaderboard / PnL claims | `/api/portfolio` derives holdings, balance, and score by replaying the trade log server-side — the client's numbers are never trusted directly |
| Telegram bot abuse | Chat-ID format validation, message length caps, and per-IP rate limiting on every alert-sending endpoint |
| Upstream proxy abuse | `/api/sodex` only forwards a fixed allowlist of known endpoints — no arbitrary path injection |
| Runaway automated requests | Rate limiting on `/api/trade`, `/api/telegram-alert`, `/api/ai-signal`, and `/api/sodex` |

---

## 🎨 Design System — "Signal"

Rebuilt around one deliberate motion language instead of stacked decorative effects, in [`app/globals.css`](app/globals.css):
* **One accent language:** electric blue + violet for data/AI, teal-green/coral for gains/losses — no competing rainbow gradients.
* **One easing system:** `--ease-reveal` (expo-out) for reveals, `--ease-micro` for hover/press micro-interactions, applied consistently instead of ad hoc per component.
* **Monospace for every number.** Prices, P&L, addresses — set in JetBrains Mono, the way a real trading terminal (not a generic SaaS landing page) actually looks.
* **The Signal Thread:** the login hero's signature motion — a glowing path that draws itself once on load, then a light travels it on loop, literally tracing the product's own pitch (data → AI → trigger → execution) instead of decorating the page with unrelated particles.
* **Respects `prefers-reduced-motion`** — every animation collapses to instant for users who ask for it.

---

## 🚀 Quick Start & Installation

```bash
# 1. Clone the repository
git clone https://github.com/Cyptoboy777/soso-smre.git
cd soso-smre

# 2. Install dependencies (Next.js Turbopack optimized)
npm install

# 3. Configure environment variables
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet!

---

## 🔑 Environment Variables Configuration (.env.local)

```env
# SoDEX API Configuration
SODEX_API_KEY=your_sodex_api_key
SODEX_API_SECRET=your_sodex_secret_key

# Essential AI Routing
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# SoSoValue APIs (ETF flows & News)
SOSOVALUE_API_KEY=your_sosovalue_key

# Firebase Cloud Database Sync
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Public app URL — used to build correct links in Telegram alerts
NEXT_PUBLIC_APP_URL=https://your-deployed-url.vercel.app
```

---

<p align="center"><b>Built to Win. Next.js × SoDEX × Wagmi × Gemini AI — signed, verified, and rate-limited end to end.</b></p>
