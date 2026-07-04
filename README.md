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
</p>

<p align="center">
  <b>🌍 Live Demo: <a href="https://soso-smre.vercel.app/login">https://soso-smre.vercel.app/login</a></b><br/>
  <i>Connect your wallet and experience the autonomous, relayerless execution workspace.</i>
</p>

---

## 🏆 Why SOSO SMRE Matters: The Ultimate Trading Terminal

In modern crypto markets, retail traders are severely disadvantaged:
1. **The Latency Trap:** Centralized search terminals display outdated data, causing traders to enter setups too late.
2. **The Execution Gap:** Converting research insights into on-chain orders requires switching between separate DEX UIs, causing slippage.
3. **The Data Silo:** Fundamental insights, technical parameters, and social momentum feeds are separated.

**SOSO SMRE** bridges these gaps by offering a **one-person institutional trading desk in a single browser tab**. It combines a **live SoDEX orderbook WebSocket feed**, **NLP-driven autonomous trade execution (SoDoggy AI)**, **direct smart contract writes (Wagmi v2)**, and **real-time Gemini 2.5 Flash research** into a premium, animated glassmorphism interface.

---

## ⚡ Wave 3 Final Additions: Operational Walkthrough

For the Wave 3 Grand Finale, the platform has transitioned from an advisory dashboard into a **fully autonomous, relayerless Web3 execution engine**:

### 🤖 1. Autonomous AI Execution (NLP Smart Triggers)
* **Code Reference:** [`app/ai-trade-agent/page.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/ai-trade-agent/page.tsx)
* Users can set NLP-driven smart trigger instructions (e.g., *"Buy 100 USDC of SOL if price drops below 140"* or *"Sell 50 USDC of BTC if price rises above 78000"*).
* The **SoDoggy AI Executor** monitors the active orderbook price stream every 10 seconds.
* Upon threshold crossing, the AI autonomously constructs, validates, and executes simulated paper trades, modifying active USDC reserves and token holdings, and logging success messages directly inside the terminal console feed.

### 🛡️ 2. Direct Smart Contract Hookup (Relayerless Route)
* **Code Reference:** [`components/TradeSetupPanel/TradeSetupPanel.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/components/TradeSetupPanel/TradeSetupPanel.tsx)
* Bypasses centralized backend relayers entirely for Web3 execution.
* Introduced a routing switch on the trade setup panel: `DIRECT CONTRACT` vs `GASLESS RELAYER`.
* Selecting `DIRECT CONTRACT` utilizes Wagmi v2's `useWriteContract` to submit transactions directly to the SoDEX Router contract address (`0x378BcADaBfF12530E57223b207aA6Fd4b93b4822`), prompting wallets to sign raw on-chain smart contract transactions.

### 🎴 3. Social "Proof of PnL" Trading Cards
* **Code Reference:** [`app/portfolio/page.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/portfolio/page.tsx)
* Built a dynamic trading card generation engine inside `/portfolio`.
* User can click **"🎴 PnL Card"** to generate a glowing holographic card snapshot showing verified ROI performance (+142.5%), net profit gains, and accumulated So-Points.
* Seamlessly wired a **"Share on X"** action using X/Twitter intent links to draft tweets containing verified stats and Buildathon tags.

### 🏆 4. Alpha Leaderboard
* **Code Reference:** [`app/leaderboard/page.tsx`](file:///c:/Users/PRASHANTHI/Downloads/soso-smre/SMRE-FINAL-V/app/leaderboard/page.tsx)
* Integrated a global Rankings board displaying real-time platform performers.
* Implemented a `framer-motion` staggered podium block showing Gold, Silver, and Bronze rankings avatars with glowing drop shadows.

---

## ⚙️ Detailed System Architecture

```
               [ LIVE DATA CHANNELS ]
       SoDEX WebSockets     SoSoValue API Feeds
              │                      │
              ▼                      ▼
       ┌────────────────────────────────┐
       │   Zustand Store (sodexStore)   │ ◄─── Persistent State Cache
       └──────────────┬─────────────────┘
                      │
            ┌─────────┴─────────┐
            ▼                   ▼
    ┌───────────────┐   ┌───────────────┐
    │ Gemini Agent  │   │  Audio Studio │
    │   (SoDoggy)   │   │   (SoEva)     │
    └───────┬───────┘   └───────────────┘
            │
            ▼
    ┌───────────────┐
    │ Execution     │ ◄─── Relayer (EIP-712 Signature API)
    │ Engine        │
    │ (Wagmi v2)    │ ◄─── Direct (useWriteContract Router Write)
    └───────────────┘
```

---

## ✨ Winning Level Features

| Feature | Description |
|---------|-------------|
| 🔴 **Live SoDEX Data Hub** | Real-time WebSocket feed from SoDEX mainnet. Prices, order books, and spreads update sub-second across the entire UI. |
| 🛡️ **Direct Web3 writes** | Full `wagmi` and `RainbowKit` integration. Support for direct contract writing bypassing relayers. |
| 🤖 **Autonomous NLP triggers** | Set natural language alerts that monitor the price stream and auto-execute orders when conditions are met. |
| 🎙️ **SoEva Podcast Studio** | Animated podcast hosts EVA & ECHO debate live ETF inflows and news with TTS speech synthesizers. |
| 📊 **Backtest Sandbox** | Simulation environment that uses historical price logs to calculate counterfactual equity returns. |
| 🎴 **Proof of PnL Cards** | Custom cyberpunk card generator that snapshots ROI and SoPoints stats for direct social sharing. |

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Cyptoboy777/soso-smre.git
cd soso-smre

# 2. Install dependencies (Turbopack ready)
npm install

# 3. Configure environment variables
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet!

---

## 🔑 Environment Variables (.env.local)

```env
# SoDEX API Configuration
SODEX_API_KEY=...
SODEX_API_SECRET=...

# Essential AI Routing
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

# SoSoValue APIs (Optional but recommended for News/ETF data)
SOSOVALUE_API_KEY=your_sosovalue_key

# Firebase & Telegram
NEXT_PUBLIC_FIREBASE_API_KEY=...
TELEGRAM_BOT_TOKEN=...
```

---

<p align="center"><b>Built to Win. Made with Next.js × SoDEX × Wagmi × Gemini AI</b></p>
