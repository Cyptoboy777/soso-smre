# SoSo SMRE (Smart Money Research Engine) 🚀

SoSo SMRE is a premium, AI-driven crypto intelligence and paper trading platform. It combines real-time market data from **SoSoValue** and **CoinGecko** with advanced LLM analysis (Gemini & Groq) to provide institutional-grade insights and autonomous trading simulations.

## 🌟 Key Features

### 1. 🤖 SOSO AI-Trader (Autonomous Agent)
*   **Autonomous Execution:** An AI agent that analyzes risk, selects strategies (Momentum, Mean Reversion, Macro-Trend), and executes paper trades automatically.
*   **Risk Profiles:** Customizable risk tolerance (Low, Medium, High) that dictates trade allocation (25% to 100% of balance).
*   **Live Terminal:** Real-time animated console showing the AI's "thought process" and execution logs.
*   **Auto-Fill Integration:** Seamlessly populates manual trade setup forms with AI-calculated values.

### 2. 🧠 Smart AI Analysis
*   **Dual-Model Validation:** Uses both **Google Gemini 2.5 Flash** and **Groq (Llama 3)** to cross-validate trading signals.
*   **Precision Targets:** Generates exact numerical Buy Zones, Sell Zones, and Stop-Loss targets based on the selected timeframe (15M to 1W).
*   **One-Click Execution:** Directly bridge AI signals to the trading terminal with pre-populated parameters.

### 3. 📰 Intelligent News Engine
*   **SoSoValue Integration:** Real-time hot news feed with exact timestamps.
*   **Smart Filtering:** 
    *   **Major News:** Critical updates (SEC, Fed, ETF) are pinned for 24 hours.
    *   **Breaking News:** Standard news rotates every 4 hours to keep the dashboard fresh.
*   **Sentiment Tracking:** AI-powered sentiment scoring (Bullish/Bearish) for each asset.

### 4. 📊 Live Portfolio Simulation
*   **Real-Time PnL:** Continuous polling (every 15s) for live price shifts from CoinGecko.
*   **USDC Paper Trading:** Starting balance of **$10,000 USDC** for every new user.
*   **Firestore Persistence:** All trades, holdings, and SoPoints are securely saved to Firebase and retained across logins.
*   **SOSO Token Sync:** Dedicated pricing layer for the SOSO token, pulling live data from CoinGecko.

### 5. 📉 SoDEX Integration
*   Live spot and perpetual market tickers.
*   Funding rates and mark prices for professional perp analysis.

---

## 🛠 Technology Stack

*   **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS.
*   **Backend:** Next.js API Routes (Serverless).
*   **Database/Auth:** Firebase (Firestore & Authentication).
*   **AI Engines:** Google Generative AI (Gemini), Groq SDK.
*   **Data Sources:** SoSoValue API, CoinGecko API.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   Firebase Project
*   API Keys: SoSoValue, Gemini, Groq.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Cyptoboy777/soso-smre.git
    cd soso-smre
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root and populate it with your keys:
    ```env
    # Gemini AI (Deep Reasoning)
    # Get your key at: https://aistudio.google.com/app/apikey
    GEMINI_API_KEY=your_gemini_api_key_here

    # Groq AI (Fast Llama 3 Inference)
    # Get your key at: https://console.groq.com/keys
    GROQ_API_KEY=your_groq_api_key_here

    # SoSoValue API (News & Market Intel)
    # Get your key at: https://sosovalue.com/developer/dashboard
    SOSOVALUE_API_KEY=your_sosovalue_api_key_here

    # Firebase Configuration (Persistence & Auth)
    # Find these in Firebase Console -> Project Settings -> Your Apps -> Web App
    NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

---

## 💡 How to Use

1.  **Login:** Securely sign in using the premium login interface.
2.  **Analyze:** Head to the **AI Analysis** tab, select an asset (e.g., BTC/USDC), and run a dual-model scan.
3.  **Trade:** 
    *   Click "Execute Trade" from the analysis result to auto-fill the trading form.
    *   Alternatively, turn on the **SOSO AI-Trader** for autonomous hands-free execution based on your risk profile.
4.  **Monitor:** Track your live PnL and total value in the **Portfolio** tab. Watch as the "Live Portfolio Simulation" ticks in real-time.
5.  **Stay Updated:** Check the sidebar or **News** page for major market shifts pinned by our retention algorithm.

---

## ⚠️ Disclaimer
SoSo SMRE is a **paper trading simulation platform**. All trades are simulated and do not involve real capital. Trading signals provided by AI are for educational and research purposes only. **Always Do Your Own Research (DYOR).**
