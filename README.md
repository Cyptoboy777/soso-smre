<p align="center">
  <img src="public/cybonk_dog.png" alt="SoDoggy — SOSO SMRE AI Mascot" width="120" />
</p>

<h1 align="center">SOSO SMRE</h1>
<h3 align="center">Smart Money Research Engine — SoSoValue Buildathon 2nd Wave</h3>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/Cyptoboy777/soso-smre"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
  &nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/SoDEX-Live%20WebSocket-green" />
  <img src="https://img.shields.io/badge/Gemini%202.5%20Flash-AI%20Powered-purple?logo=google" />
</p>

---

## 🏆 What is SOSO SMRE?

**SOSO SMRE** is a one-person finance company in a browser. It combines **live SoDEX market data**, **Gemini 2.5 Flash AI analysis**, and a **premium dark cyberpunk UI** to give retail traders the same tools that institutions use — for free.

Built for the **SoSoValue Buildathon 2nd Wave**, this is not a demo. It is production-deployed, data-live, and judge-ready.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔴 **Live SoDEX Market** | Real-time WebSocket feed from SoDEX mainnet. Prices, order books, spreads update sub-second. |
| 📊 **Professional Chart** | TradingView Lightweight Charts with Binance historical K-lines, live candle sync to SoDEX prices, multi-timeframe (1m–1d), volume histogram, crosshair. |
| 🤖 **SoDoggy AI Assistant** | Cyberpunk Shiba Inu AI powered by Gemini 2.5 Flash + Groq LLaMA 3.3. Real-time market context, voice input/output, expand to full analyst panel. |
| 🎙️ **SoEva Dual-Host Studio** | AI podcast: two animated hosts (EVA + ECHO) debate live market conditions with TTS voice. 4 emotion modes, skip/pause/replay. |
| 📰 **Breaking News** | SoSoValue news API (major vs normal, smart age filtering) + Reddit fallback. Live ticker tape across the top. |
| 📡 **Telegram Alpha Bot** | One-click daily AI-generated alpha signal sent straight to your Telegram. |
| 📈 **ETF Dashboard** | Bitcoin ETF flow tracking powered by SoSoValue ETF data. |
| 🔐 **Auth** | Firebase email + MetaMask wallet connect (EIP-1193). |
| ⚡ **Testnet Trading** | Place limit/market orders on SoDEX testnet with simulated USDC balance. |

---

## 🖼️ Screenshots

> *(Add screenshots here after deployment)*

| Dashboard | SoDEX Markets | SoDoggy AI |
|-----------|--------------|------------|
| ![dashboard](public/smre-dashboard.html) | *sodex-markets* | *sodoggy* |

---

## 🏗️ Architecture

```
soso-smre/
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── dog-chat/           # Gemini + Groq AI chat (rate-limited)
│   │   ├── daily-alpha/        # AI-generated daily market alpha
│   │   ├── news/               # SoSoValue + Reddit news (smart filtering)
│   │   ├── prices/             # SoDEX cache → CoinGecko fallback
│   │   ├── tokens/             # Live token list from SoDEX
│   │   └── telegram-alert/     # Telegram bot integration
│   ├── dashboard/              # Main trading dashboard
│   ├── sodex-markets/          # Full DEX trading terminal
│   ├── ai-analysis/            # Deep AI market analysis
│   ├── portfolio/              # Portfolio tracker
│   └── ...
├── components/
│   ├── SoDoggy/                # AI assistant — modular
│   │   ├── SoDoggyAssistant.tsx
│   │   ├── SoDoggyBody.tsx
│   │   └── hooks/
│   ├── SoEva/                  # Dual-host AI podcast — modular ⭐
│   │   ├── SoEva.tsx           # Orchestrator (~130 lines)
│   │   ├── HostOrb.tsx         # Animated speaking orb
│   │   ├── ScriptPanel.tsx     # Script display
│   │   ├── PlayerControls.tsx  # Transport + emotion selector
│   │   ├── useEvaState.ts      # All business logic
│   │   └── types.ts            # Shared types
│   ├── SodexProfessionalChart.tsx  # TradingView Lightweight Charts ⭐
│   ├── SodexMarket.tsx         # Order book + market ticker
│   ├── ErrorBoundary.tsx       # Crash-safe wrapper
│   └── ...
├── hooks/
│   └── useSodexWS.ts           # Production WS hook (ping, reconnect, cleanup)
├── lib/
│   ├── sodex.ts                # Normalizers + formatters
│   ├── newsFilter.ts           # Shared news filtering (DRY) ⭐
│   └── ...
└── types/
    └── sodex.ts                # Strict TypeScript types
```

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/Cyptoboy777/soso-smre.git
cd soso-smre

# 2. Install
npm install

# 3. Configure env (copy and fill in)
cp .env.example .env.local

# 4. Run dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

# Optional but unlock full features
SOSOVALUE_API_KEY=your_sosovalue_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5.7 (strict) |
| Styling | Vanilla CSS + CSS variables + Framer Motion |
| Charts | **TradingView Lightweight Charts** |
| Data | **SoDEX WebSocket** (mainnet + testnet) |
| AI | **Gemini 2.5 Flash** + Groq LLaMA 3.3 (fallback) |
| Market Data | SoSoValue API + CoinGecko fallback |
| Auth | Firebase + MetaMask (EIP-1193) |
| Deployment | Vercel (Edge Functions) |

---

## 🎯 Why This Will Win

1. **Real data** — Not a mock. SoDEX WebSocket delivers sub-second live prices.
2. **AI depth** — SoDoggy and SoEva are not chatbots. They are market analysts with live price context, news context, and emotional modes.
3. **Code quality** — Clean modular architecture, strict TypeScript, no memory leaks, AbortController for every fetch.
4. **Production-grade** — Error boundaries, loading states, rate limiting, Firebase auth, Telegram integration.
5. **Unique UX** — Cyberpunk aesthetic, animated dual-host AI podcast, voice input/output — nothing like it exists.

---

## 👤 Author

Built with 🔥 for the **SoSoValue Buildathon 2nd Wave**

**GitHub**: [@Cyptoboy777](https://github.com/Cyptoboy777)

---

<p align="center">Made with Next.js × SoDEX × Gemini AI × ❤️</p>
