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

# Updates in this Wave ⚡ Wave 3 Final Edition
🏆 Wave 2 → Wave 3 = superset.
**Live Portal:** [https://soso-smre.vercel.app](https://soso-smre.vercel.app/login)
**Repo:** [https://github.com/Cyptoboy777/soso-smre](https://github.com/Cyptoboy777/soso-smre)
**Release:** [https://github.com/Cyptoboy777/soso-smre/releases/tag/wave-3-final](https://github.com/Cyptoboy777/soso-smre/releases/tag/wave-3-final)

---

## 🏆 Core API Integrations (High-Value Engines)

Our platform leverages direct mainnet APIs to power live Web3 execution and AI analytics:

### 🔴 1. SoDEX API Integration (Live Trading Execution)
* **API Scope:** Uses `SODEX_API_KEY` and `SODEX_API_SECRET`.
* **Application:** Authorizes cryptographic trade payloads, queries live orderbook imbalances, tracks real-time market trades, and executes on-chain and off-chain orders through our Next.js relay pipelines.
* **Why it matters:** Gives traders low-latency access directly to the SoDEX matching engine, ensuring sub-second execution speeds.

### 📊 2. SoSoValue API Integration (Alpha & ETF Stream)
* **API Scope:** Uses `SOSOVALUE_API_KEY`.
* **Application:** Ingests live institutional ETF flow metrics (US Spot BTC/ETH ETF inflows) and premium macroeconomic news feeds.
* **AI Synergy:** These feeds directly feed the **SoDoggy AI news tagging model** (`/api/news/sentiment`) and the **SoEva AI debate script generator** (`/api/dog-chat`), producing institutional-grade daily summaries.

---

## 🚀 Delivered Against Declared Wave 3 Goals (Autonomous & Relayerless Web3 Execution)

### ✅ Autonomous AI Trading (NLP Smart Triggers)
* Users can set NLP-driven smart trigger instructions (e.g., *"Buy 100 USDC of SOL if price drops below 140"* or *"Sell 50 USDC of BTC if price rises above 78000"*).
* The **SoDoggy AI Executor** monitors the active orderbook price stream every 10 seconds.
* Upon threshold crossing, the AI autonomously constructs, validates, and executes simulated paper trades, modifying active USDC reserves and token holdings, and logging success messages directly inside the terminal console feed.

### ✅ Direct Smart Contract Hookup (Relayerless Routes)
* Bypasses centralized backend relayers entirely for Web3 execution.
* Introduced a routing switch on the trade setup panel: `DIRECT CONTRACT` vs `GASLESS RELAYER`.
* Selecting `DIRECT CONTRACT` utilizes Wagmi v2's `useWriteContract` to submit transactions directly to the SoDEX Router contract address (`0x378BcADaBfF12530E57223b207aA6Fd4b93b4822`), prompting wallets to sign raw on-chain smart contract transactions.

### ✅ Social "Proof of PnL" (Cyberpunk Trading Cards)
* Built a dynamic trading card generation engine inside `/portfolio`.
* User can click **"🎴 PnL Card"** to generate a glowing holographic card snapshot showing verified ROI performance (+142.5%), net profit gains, and accumulated So-Points.
* Seamlessly wired a **"Share on X"** action using X/Twitter intent links to draft tweets containing verified stats and Buildathon tags.

### ✅ Alpha Leaderboard
* Integrated a global Rankings board displaying real-time platform performers.
* Implemented a `framer-motion` staggered podium block showing Gold, Silver, and Bronze rankings avatars with glowing drop shadows.

---

## 🎯 Bonus Features Beyond the Declared Goals

### 🎙️ AI Podcast Studio (SoEva)
* A modular, animated conversation studio featuring animated hosts EVA and ECHO.
* Ingests SoSoValue BTC/ETH ETF inflows and macroeconomic news, generating a dynamic debate script using Gemini 2.5 Flash.
* Speaks out the script using localized TTS synthesizers with pause, resume, and emotion indicators.

### 📊 Strategy Backtesting Sandbox (Backtest AI)
* Allows traders to historical-backtest custom strategies (e.g., RSI, Mean Reversion, breakouts) against historical token candles.
* Renders counterfactual ROI charts and yields, verified against actual historical parameters.

### 📱 Telegram Daily Alpha
* Users can configure their Telegram Chat IDs under `/settings` to hook up custom daily alert feeds.
* AI compiles daily market analysis using Gemini and broadcasts 1-click alpha insights directly to users' mobile phones.

---

## 🛠️ Stack
* **Frontend/Core:** Next.js 16.2 (Turbopack) · TypeScript 5.7 · Tailwind CSS · Zustand (Persistent Storage)
* **Web3 Integration:** Wagmi v2 · RainbowKit · Viem
* **AI Pipelines:** Google GenAI SDK (Gemini 2.5 Flash) · Web Speech TTS Engine
* **Backend Database:** Firebase Auth · Firestore Real-time Cloud Sync

Built solo by **@Cyptoboy777**.
