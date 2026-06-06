<p align="center">
  <img src="public/cybonk_dog.png" alt="SoDoggy — SOSO SMRE AI Mascot" width="120" />
</p>

<h1 align="center">SOSO SMRE ⚡ Wave 2</h1>
<h3 align="center">Smart Money Research Engine — SoSoValue Buildathon</h3>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/Cyptoboy777/soso-smre"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
  &nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/SoDEX-Live%20WebSocket-green" />
  <img src="https://img.shields.io/badge/Wagmi-Web3%20Ready-blue" />
  <img src="https://img.shields.io/badge/Gemini%202.5%20Flash-AI%20Powered-purple?logo=google" />
</p>

---

## 🏆 What is SOSO SMRE?

**SOSO SMRE** is a one-person finance company in a browser. It combines **live SoDEX market data**, **Gemini 2.5 Flash AI analysis**, and a **premium dark cyberpunk UI** to give retail traders the same tools that institutions use — completely free.

Built specifically for the **SoSoValue Buildathon 2nd Wave**, this is not a mock UI. It is production-ready, highly reactive, fully typed, and deeply integrated with Web3 execution via RainbowKit and Wagmi.

---

## ⚙️ How the Architecture Works (In Detail)

We built SOSO SMRE to mirror the performance of a centralized exchange frontend while maintaining Web3 decentralization via SoDEX.

### 1. Live SoDEX Data Hub (WebSocket & REST)
- **The Connection:** We use a highly robust custom React Hook (`useSodexWS`) that maintains a persistent `wss://` connection to the SoDEX matching engine.
- **Data Flow:** Every sub-second, it ingests thousands of orderbook updates, spread calculations, and 24h ticker metrics.
- **Global Volatility:** These updates are dispatched into a massive `zustand` memory store (`sodexStore.ts`). 
- **UI Reaction:** The entire app—from the Top Navigation Marquee to the AI Agent Data Context to the TradingView Lightweight Chart—subscribes to this Zustand store and re-renders at 60fps without freezing the browser.

### 2. The Execution Engine (Wagmi + EIP-712)
Trading on SoDEX requires cryptographic signatures to prove intent before submitting to the decentralized orderbook.
- **Wallet Connection:** Handled globally by `RainbowKit`.
- **Real-Time Balances:** The `TradeSetupPanel` queries your actual on-chain USDC/ETH balance via the Wagmi `useBalance` hook. Your real capital determines your position sizing limits.
- **EIP-712 Signatures:** When you click **"EXECUTE TRADE"**, the app constructs a structured payload (`symbol, side, price, size, nonce`). It calls `signTypedDataAsync` via Wagmi, prompting your wallet (MetaMask, Rabby, etc.) to sign a human-readable authorization.
- **Backend Relay:** The signature and payload are securely forwarded to our Next.js Edge APIs (`/api/trade`) for validation and execution on the SoDEX network.

### 3. Persistent Portfolio Store (Zustand Mock DB)
We implemented a brilliant mock-database layer for instantaneous visual feedback.
- **Local Storage Sync:** We built `portfolioStore.ts` using `zustand/middleware/persist`. 
- **Instant UI Feedback:** When your trade successfully executes, the position is pushed into this store.
- **Glowing Data Grids:** The bottom UI bar instantly updates from "Empty State" to a sleek table showing your `UNREALIZED PNL`. The right-side "MARKET TRADES" tape catches your execution, flashing a bright **"YOU"** badge alongside the global trades tape. 
- **Persistence:** If you refresh the page, your paper capital and executed positions survive perfectly.

### 4. Dual-Agent AI Architecture
- **SoDoggy (The Analyst):** Powered by Gemini 2.5 Flash. SoDoggy scans the live SoDEX orderbook imbalance, recent SoSoValue news APIs, and computes trend exhaustion to deliver instantaneous "Buy/Sell" insights directly inside the Trade Setup Panel.
- **SoEva (The Podcast):** An autonomous background task pulls Bitcoin ETF inflow data and macroeconomic news. Two localized TTS voices debate the market trend in a cyberpunk animated studio.

---

## ✨ Winning Level Features

| Feature | Description |
|---------|-------------|
| 🔴 **Live SoDEX Data Hub** | Real-time WebSocket feed from SoDEX mainnet. Prices, order books, and spreads update sub-second across the entire UI. |
| 🛡️ **Web3 Execution** | Full `wagmi` and `RainbowKit` integration. Live on-chain balances. **EIP-712 typed data signatures** to authorize real trades. |
| 🗃️ **Persistent Portfolio** | Zustand `persist` engine. Your paper capital, daily PnL, and executed positions survive page refreshes, acting as a blazing fast local database. |
| 🤖 **SoDoggy Agent** | Gemini 2.5 Flash + Groq LLaMA 3.3 fallback. Real-time market context, voice I/O, and instant token search. |
| 📊 **Bloomberg-Tier UI** | TradingView Lightweight Charts synced live to SoDEX. Personal orders flash on the global tape upon execution. |
| 🎙️ **SoEva Podcast** | Animated podcast hosts (EVA + ECHO) debate live market conditions with TTS voice. 4 emotion modes, skip/pause/replay. |
| 📰 **News & Telegram** | SoSoValue news API filtered by smart age. Telegram Bot integration sends 1-click daily AI alpha signals directly to your phone. |
| 🔐 **Hybrid Auth** | Firebase email/password auth side-by-side with decentralized Web3 wallet connection. |

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

Check `.env.example` for the full layout. Here is a brief explanation:

```env
# 1. SoDEX API Configuration
# Used by the backend to submit your signed EIP-712 payloads to the matching engine.
SODEX_API_KEY=...
SODEX_API_SECRET=...

# 2. Essential AI Routing
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

# 3. SoSoValue APIs (Optional but recommended for News/ETF data)
SOSOVALUE_API_KEY=your_sosovalue_key

# 4. Firebase & Telegram
NEXT_PUBLIC_FIREBASE_API_KEY=...
TELEGRAM_BOT_TOKEN=...
```

---

<p align="center"><b>Built to Win. Made with Next.js × SoDEX × Wagmi × Gemini AI</b></p>
