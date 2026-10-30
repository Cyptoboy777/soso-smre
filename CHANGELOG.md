# Changelog

## Wave 3 (since Jul 4 submission)

Rebuild as **FlowSentinel** — cut feature sprawl and ship a single insight→action loop for the AKINDO SoSoValue buildathon Wave 3.

### Removed (judge feedback: sprawl)
- Podcast / SoEva host, SoDoggy assistant, Telegram alerts
- Leaderboard, achievements, backtest UI
- Wallet-gated main path (RainbowKit / wagmi no longer required to demo)
- Mock data presented as live when keys were missing

### Added
- Premium polish: animated FlowRadar, CountUp metrics, staggered panels, refined logo/favicon, empty/fallback states
- Multilingual **Voice desk** (Web Speech STT/TTS): thesis / risk / flows / news Q&A; never places orders by voice

- SoSoValue-first desk: BTC/ETH US ETF flows, hot news, ssiMAG7, SoDEX tickers
- Honest **Live / Fallback** badges on every data panel
- AI daily thesis (Gemini) with confidence + drivers; deterministic rules fallback
- Risk gate: sizing, max drawdown, geometry, confidence floor, news-shock pause — pass/fail reasons
- Explicit confirmation → SoDEX **testnet** limit order (dry-run when keys absent)
- Public track record with entry, horizon, outcome, hit rate — no invented PnL
- Judge/demo mode page with 3-click path
- SoSoValue / SoDEX brand theme (`#FF4F20`, `#FF7637`, `#7F2711`, ink greys)
- Unique FlowSentinel logo (sentinel aperture / FlowRadar)
- Unit tests for risk engine + signal logic

### Integration endpoints
- SoSoValue: `GET /etfs/summary-history`, `GET /news/hot`, `GET /indices/{ticker}/market-snapshot` (header `x-soso-api-key`)
- SoDEX: public `GET /markets/tickers`; authenticated `POST /orders` on testnet when keys set
