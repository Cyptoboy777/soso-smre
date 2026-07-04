<p align="center">
  <img src="public/cybonk_dog.png" alt="SoDoggy — SOSO SMRE AI Mascot" width="120" />
</p>

<h1 align="center">SOSO SMRE ⚡ Wave 3 (Winner's Edition)</h1>
<h3 align="center">Smart Money Research Engine — SoSoValue Buildathon Grand Finale Build</h3>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/Cyptoboy777/soso-smre"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
  &nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/SoDEX-Live%20WebSocket-green" />
  <img src="https://img.shields.io/badge/Wagmi-Web3%20Ready-blue" />
  <img src="https://img.shields.io/badge/Gemini%202.5%20Flash-AI%20Powered-purple?logo=google" />
</p>

<p align="center">
  <b>🌍 Live Demo: <a href="https://soso-smre.vercel.app/login">https://soso-smre.vercel.app/login</a></b><br/>
  <i>Connect your Web3 wallet and experience the world's most advanced autonomous, relayerless execution workspace.</i>
</p>

---

## 🏆 Core Philosophy: Why SOSO SMRE?

In modern decentralized finance, retail traders face severe structural barriers that keep them behind institutions:
1. **The Latency Trap:** Classic research terminals fetch stale database data. In volatile Web3 markets, entering a setup seconds late ruins the risk-to-reward ratio.
2. **The Execution Friction:** Turning a research discovery into a DEX trade requires switching tabs, connecting wallets, calculating sizes, and managing slippage, leading to execution delay.
3. **The Data Silo:** Fundamental news streams (ETF flows, macroeconomic updates), technical chart analysis, and social sentiment are separate, preventing clear decision-making.

**SOSO SMRE** solves these challenges by combining a **real-time SoDEX WebSocket orderbook**, **on-chain direct contract execution (Wagmi v2)**, **NLP-driven autonomous execution triggers**, and **Gemini 2.5 Flash analysis** into a single, high-performance cyberpunk terminal.

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
       │                     EXECUTION ENGINE                      │
       ├───────────────────────────┬───────────────────────────────┤
       │  Relayer Route (EIP-712)  │  Direct Contract Router Write │
       └───────────────────────────┴───────────────────────────────┘
```

---

## ✨ Comprehensive Breakdown of Unique Features

### 🤖 1. Autonomous NLP Trading Engine
* **The Problem:** Traders identify setups but miss entries due to sleep, meetings, or distraction.
* **The Solution:** A natural language processing trigger system inside [`app/ai-trade-agent/page.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/ai-trade-agent/page.tsx).
* **Technical Details:**
  * Uses a robust regex NLP utility (`parseNlpTrigger`) to convert user sentences (e.g., *"Buy 100 USDC of SOL if price drops below 140"*) into structured parameters: `symbol`, `type` (`BUY`|`SELL`), `amount`, `conditionType` (`above`|`below`), and `targetPrice`.
  * Every 10 seconds, the engine compares active triggers against live pricing socket updates.
  * When targets are crossed, it autonomously executes a trade payload, updates `localStorage` and **Firestore**, and logs the confirmation in the terminal.

---

### 🛡️ 2. Direct Smart Contract Route (Relayerless Mode)
* **The Problem:** Centralized backend relayers introduce a point of failure, censorship risk, and latency.
* **The Solution:** Fully relayerless, direct smart contract execution in [`components/TradeSetupPanel/TradeSetupPanel.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/components/TradeSetupPanel/TradeSetupPanel.tsx).
* **Technical Details:**
  * Integrates a toggle: `DIRECT CONTRACT` vs `GASLESS RELAYER`.
  * Selecting `DIRECT CONTRACT` utilizes Wagmi v2's `useWriteContract` to submit transactions directly to the SoDEX Router contract address (`0x378BcADaBfF12530E57223b207aA6Fd4b93b4822`), prompting wallets to sign raw on-chain smart contract transactions.

---

### 🎴 3. Social "Proof of PnL" Card Generator
* **The Problem:** Sharing trading metrics on X or Telegram requires taking screenshots and cropping tables, which are easily faked.
* **The Solution:** Dynamic cryptographic proof-of-performance card generator inside [`app/portfolio/page.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/portfolio/page.tsx).
* **Technical Details:**
  * Compiles live paper-trading records, daily ROI (+142.5%), Net Profit, and accumulated platform So-Points into a glowing cyberpunk trading card overlay.
  * Connects directly to X/Twitter intent sharing URLs to publish verified stats with one click.

---

### 🎙️ 4. AI Podcast Studio (SoEva & Echo)
* **The Problem:** Reading lengthy ETF inflow reports and macro newsletters is time-consuming.
* **The Solution:** An autonomous background audio generation panel inside [`components/SoEva/index.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/components/SoEva/index.tsx).
* **Technical Details:**
  * Ingests real-time ETF inflow metrics and macro news, generating an interactive debate script using Gemini 2.5 Flash.
  * Speaks out the script using localized TTS synthesizers with pause, resume, and emotion indicators.

---

### 📊 5. Backtesting Sandbox
* **The Problem:** Traders want to verify if an AI strategy is profitable before risking capital.
* **The Solution:** Historic simulation workbench inside [`app/backtest/page.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/backtest/page.tsx).
* **Technical Details:**
  * Pulls historical market metrics and simulates strategy performance (RSI, Breakouts, Mean Reversion).
  * Renders a interactive line chart showing the counterfactual performance curve versus buy-and-hold strategies.

---

### 📱 6. Telegram Daily Alpha Alerts
* **The Problem:** Traders are away from their screens when market trends shift.
* **The Solution:** Telegram Webhook bot integration configured under [`app/settings/page.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/settings/page.tsx).
* **Technical Details:**
  * Sends verified daily market insights and buy/sell alerts directly to the user's Telegram Chat ID.

---

## 🎨 Design Tokens & UI Aesthetics

Built using custom glassmorphism and cyberpunk design classes in [`app/globals.css`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/globals.css):
* `.figma-card`: Hover transitions using `transform: translateY(-4px) scale(1.01)` and glowing box-shadow borders.
* `.figma-btn`: Linear-gradient shift animation loop representing luxury DeFi styles.
* `.smart-status-indicator`: Radiant expanding animation loop signifying real-time WebSocket connectivity.
* `.neon-glow-text`: Subtle indigo drop shadows for maximum font readability against dark backdrops.

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
```

---

<p align="center"><b>Built to Win. Next.js × SoDEX × Wagmi × Gemini AI</b></p>
