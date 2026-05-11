# SoSo SMRE (Smart Money Research Engine) 🚀

**SoSoValue Buildathon Submission - The Ultimate One-Person Agentic Finance Business**

SoSo SMRE is a premium, AI-driven crypto intelligence and automated execution platform. Built explicitly for the SoSoValue Buildathon, it leverages the **SoSoValue API, SoDEX infrastructure, and dual-LLM (Gemini & Groq) analysis** to transform a single user into a complete financial news agency, opportunity discovery engine, and quantitative fund manager.

---

## 1. Project Overview

*   **Project Name:** SoSo SMRE (Smart Money Research Engine)
*   **Short Description:** An all-in-one "Signal-to-Execution Agent" and "Opportunity Discovery Engine" that integrates live SoSoValue market intelligence with an autonomous, background-running AI Trader. It features Freqtrade-inspired advanced execution, multi-exchange routing (via SoDEX API), and a deeply immersive cyberpunk UI.
*   **Target Users:** Retail traders, quantitative researchers, and solo-founders looking to build agentic finance applications on-chain without needing a large team.
*   **Core Logic:**
    *   **Data Aggregation:** Pulls real-time financial news, institutional shifts, and spot market tickers.
    *   **AI Signal Generation:** Routes market data through dual LLMs (Gemini 2.5 Flash + Groq Llama 3) to validate Momentum & Sentiment signals.
    *   **Execution & Risk Control:** A Freqtrade-inspired autonomous execution module handles Multi-Exchange routing (SoDEX default), Max Open Trades limits, and Dynamic Trailing Stop-Losses.
    *   **State Persistence:** Hybrid Dual-Sync architecture (localStorage + Firestore) ensures zero-latency PnL tracking while maintaining cloud permanence.
*   **APIs and Data Sources:**
    *   **SoSoValue API:** Core structured financial news, market intelligence, and ETF flow data.
    *   **SoDEX API (`api.sodex.xyz`):** High-performance spot market data, orderbook routing, and ticker integrations.
    *   **CoinGecko API:** Supplemental real-time pricing for the top 50 global crypto assets.
    *   **Google Gemini & Groq APIs:** Powering the AI "Genius" trading engine and the SoDoggy voice assistant.

---

## 2. Public GitHub Repository & Setup

**Repository Link:** [https://github.com/Cyptoboy777/soso-smre](https://github.com/Cyptoboy777/soso-smre)

### Prerequisites
*   Node.js 18+
*   Firebase Project
*   API Keys: SoSoValue, Gemini, Groq.

### Installation & Setup Instructions

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
    # AI Engines
    GEMINI_API_KEY=your_gemini_api_key_here
    GROQ_API_KEY=your_groq_api_key_here

    # Core Infrastructure
    SOSOVALUE_API_KEY=your_sosovalue_api_key_here

    # Firebase Configuration (Persistence)
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

## 3. Demo

*   **Public Live Demo Link:** [Insert Vercel/Netlify Deployment Link Here]

*(Our interactive demo allows users to start the SoDoggy assistant, view live SoDEX markets, and activate the background AI Trader to watch real-time simulated PnL.)*

---

## 4. Video Introduction

*   **YouTube/Loom Video Link:** [Insert Video Demo Link Here]

*(The video demonstrates the core workflow: Discovery via SoSoValue news -> AI Signal Validation -> SoDEX Market selection -> Autonomous Execution -> Live PnL tracking.)*

---

## 5. Team Information

*   **Team Name:** Cyber Syndicate
*   **Team Members:** 
    *   Prashanthi (Lead Architect / Solo Founder)
*   **Contact Info:** [Insert Email / Discord Handle Here]

---

## 6. Wave Progress Update (Changelog)

### Wave 1 – Concept & Early Prototype
*   **Use Case Defined:** Designed the architecture for a single-person quantitative trading firm.
*   **Workflow Design:** Mapped out the "Insight to Action" pipeline (News -> Signal -> Trade -> Portfolio).
*   **Core UI:** Built the cyberpunk-themed Next.js dashboard featuring a persistent Global State Provider for zero-latency interactions.

### Wave 2 – Build Phase I (Current Focus)
*   **SoSoValue API Integration:** Successfully connected and mapped structured news and market data into the platform.
*   **SoDEX API Integration:** Built a dedicated `SoDEX Markets` dashboard pulling real-time, high-performance spot market tickers directly from `api.sodex.xyz`.
*   **AI Agent Upgrade:** Upgraded the AI Trader with Freqtrade-inspired advanced settings:
    *   Target Exchange routing (SoDEX / Binance / Bybit).
    *   Dynamic Target Syncing (Take-Profit auto-adjusts to +3% and Stop-Loss to -2% when switching tokens).
    *   Max Open Trades & Dynamic Trailing Stop-Loss features.
*   **Data Integrity Fixes:** Solved hydration and race-condition bugs with Firestore, ensuring seamless offline/online Portfolio tracking.

### Wave 3 – Build Phase II (Upcoming Goals)
*   **Social Alpha (Telegram & X Integration):** Real-time alert system pushing AI trade executions, signals, and SoSoValue breaking news directly to a customized Telegram Bot and X (Twitter) feed.
*   **Custom AI Personas:** Allow users to build and train their own AI agents with unique trading styles and risk appetites.
*   **Mainnet SoDEX Execution:** Transition from paper trading to live on-chain execution via SoDEX Mainnet API.
---

## 🏆 How We Address the Judging Criteria

*   **User Value (30%):** Empowers a single user to run a full-scale AI trading desk. The platform automatically digests news, discovers opportunities, and executes risk-managed trades.
*   **Functionality (25%):** Fully functional paper-trading simulator, background AI execution loop, and real-time PnL syncing.
*   **Logic & Workflow (20%):** A strict "Research-to-Execution" pipeline. Users read SoSoValue news -> Verify with AI -> Execute via Terminal.
*   **Data Integration (15%):** Deep integrations with SoSoValue News, SoDEX Tickers, and CoinGecko top 50 asset APIs.
*   **UX (10%):** World-class, immersive "hacker-style" UI with glassmorphism, glowing micro-animations, and persistent background features (like the AI Audio Podcast).

---

### ⚠️ Disclaimer
SoSo SMRE is currently a **trading simulation and research platform**. All executed trades are simulated for the Buildathon context. Trading signals provided by the AI are for educational purposes. **Always Do Your Own Research (DYOR).**
