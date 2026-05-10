# SoSo SMRE (Smart Money Research Engine) 🚀

SoSo SMRE is a premium, AI-driven crypto intelligence and paper trading platform. It combines real-time market data from **SoSoValue** and **CoinGecko** with advanced LLM analysis (Gemini & Groq) to provide institutional-grade insights and autonomous trading simulations.

## 🌟 Key Features

### 1. 🤖 Global Background AI-Trader (Autonomous Agent)
*   **True Background Execution:** The "Genius" AI engine runs persistently across all pages. You can start the trader, navigate to other pages, and it will continue analyzing and executing trades silently in the background.
*   **Autonomous Execution:** An AI agent that analyzes risk, selects strategies (Momentum, Mean Reversion, Macro-Trend), and executes paper trades automatically.
*   **Risk Profiles:** Customizable risk tolerance (Low, Medium, High) that dictates trade allocation (25% to 100% of balance).
*   **Live Terminal:** Real-time animated console showing the AI's "thought process" and execution logs.

### 2. 🐕 Cybonk Dog Assistant & Voice Podcast
*   **3D Cyberpunk Dog:** An interactive, animated Shiba Inu hacker assistant ("SoDoggy") featuring CSS 3D floating, speaking animations, and holographic glitch effects.
*   **Real Dog Audio & Emotions:** SoDoggy barks and pants dynamically with real audio while displaying floating emotional emojis (🔥, 🚀, ⚡) based on market context.
*   **Persistent Market Podcast:** A daily AI-generated "Quick Market Podcast" that plays continuously in the background. It summarizes live news, BTC/ETH prices, and market sentiment. The audio seamlessly persists across all route changes.

### 3. 📊 Perfect Sync Portfolio & Futures Trading
*   **Zero-Latency Sync:** A hybrid Dual-Sync architecture (localStorage + Firestore) ensures that any trade executed by the AI instantly updates your Portfolio PnL and Holdings without a single page refresh.
*   **Spot & Futures Paper Trading:** A dedicated manual trading terminal supporting both SPOT and FUTURES execution with custom leverage multipliers up to 100x.
*   **Real-Time PnL:** Continuous polling for live price shifts.
*   **Offline-First Resilience:** Ensures that trading features are always instantly available, syncing to the cloud securely in the background.

### 4. 🧠 Smart AI Analysis & News Engine
*   **Dual-Model Validation:** Uses both **Google Gemini 2.5 Flash** and **Groq (Llama 3)** to cross-validate trading signals.
*   **Precision Targets:** Generates exact numerical Buy Zones, Sell Zones, and Stop-Loss targets based on the selected timeframe (15M to 1W).
*   **SoSoValue Integration:** Real-time hot news feed with smart filtering, separating breaking news from long-term institutional shifts.

---

## 🛠 Technology Stack

*   **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS.
*   **State Management:** Context API (GlobalStateProvider) + Dual-Sync localStorage.
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
    GEMINI_API_KEY=your_gemini_api_key_here

    # Groq AI (Fast Llama 3 Inference)
    GROQ_API_KEY=your_groq_api_key_here

    # SoSoValue API (News & Market Intel)
    SOSOVALUE_API_KEY=your_sosovalue_api_key_here

    # Firebase Configuration (Persistence & Auth)
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
2.  **Talk to SoDoggy:** Open the bottom right Cyberpunk Dog widget to get instant voice-enabled market analysis.
3.  **Listen to Alpha:** Start the "Quick Market Podcast" to listen to background market briefings while you browse.
4.  **Trade:** 
    *   Turn on the **SOSO AI-Trader** for background, autonomous hands-free execution.
    *   Manually execute SPOT or FUTURES trades in the Terminal.
5.  **Monitor:** Track your perfectly synced live PnL and total value in the **Portfolio** tab.

---

## ⚠️ Disclaimer
SoSo SMRE is a **paper trading simulation platform**. All trades are simulated and do not involve real capital. Trading signals provided by AI are for educational and research purposes only. **Always Do Your Own Research (DYOR).**
