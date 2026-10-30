# FlowSentinel

AI **one-person fund desk** for the [AKINDO SoSoValue buildathon Wave 3](https://sosovalue.com) — *Build Your One-Person On-Chain Finance Business with SoSoValue*.

Reads **SoSoValue** ETF flows, hot news and SSI → writes a plain-English daily thesis with confidence → runs a **risk gate** → places a **confirmed SoDEX testnet** limit order → logs an honest **public track record**.

Live production (previous waves): https://soso-smre.vercel.app  
This Wave 3 work lives on branch `flowsentinel-wave3` (preview / PR — not production).

---

## Judge path (3 clicks)

1. Open **Desk** (`/`) — thesis, FlowRadar, Live/Fallback panels  
2. Scroll to **Risk gate** — tick confirm → **Place testnet / dry-run order**  
3. Open **Track record** (`/track-record`) — logged idea + hit rate  

Or start at `/demo`.

No wallet. No login.

---

## Architecture

```
SoSoValue API ─┐
               ├─► /api/thesis ─► Thesis (Gemini | rules) ─► Risk gate
SoDEX tickers ─┘                                              │
                                                              ▼
                                         User confirms ─► /api/trade ─► SoDEX testnet
                                                              │         (or dry-run)
                                                              ▼
                                                      /api/track-record
```

| Layer | Role |
| --- | --- |
| `lib/sosovalue.ts` | SoSoValue client (`x-soso-api-key`) + labelled fallbacks |
| `lib/sodex.ts` | Public tickers + dry-run / keyed order place |
| `lib/signal.ts` | Deterministic flow→side scoring |
| `lib/thesis.ts` | Gemini wrapper → rules fallback |
| `lib/risk-engine.ts` | Pass/fail checks + position size |
| `lib/track-record.ts` | File-backed honest log (`data/track-record.json`) |

### Endpoints used

**SoSoValue** — base `https://openapi.sosovalue.com/openapi/v1`

| Method | Path | Use |
| --- | --- | --- |
| GET | `/etfs/summary-history?symbol=BTC\|ETH&country_code=US` | ETF net flows |
| GET | `/news/hot` | Hot news + shock filter |
| GET | `/indices/ssimag7/market-snapshot` | SSI index |

**SoDEX** — testnet `https://testnet-gw.sodex.dev/api/v1/spot`

| Method | Path | Use |
| --- | --- | --- |
| GET | `/markets/tickers` | Spot marks (public) |
| POST | `/orders` | Limit order when `SODEX_*` set |

App routes: `/api/thesis`, `/api/risk`, `/api/trade`, `/api/track-record`, `/api/soso/*`.

---

## Env vars

Copy `.env.example` → `.env.local` (never commit secrets).

| Var | Required for | If missing |
| --- | --- | --- |
| `SOSOVALUE_API_KEY` | Live ETF / news / SSI | Labelled **Fallback** panels |
| `GEMINI_API_KEY` | LLM thesis | Deterministic rules thesis |
| `SODEX_API_KEY` | Testnet order | **Dry-run** order id |
| `SODEX_API_SECRET` | Testnet order | **Dry-run** |
| `FLOWSENTINEL_DEMO_MODE` | Force demo label | Optional (`0`/`1`) |
| `NEXT_PUBLIC_APP_URL` | Absolute links | `http://localhost:3000` |

---

## Local run

```bash
npm install
npm run test
npm run dev
# http://localhost:3000
```

```bash
npm run build   # must pass
```

---

## Brand

Theme built from researched SoSoValue / SoDEX colours:

| Hex | Source |
| --- | --- |
| `#FF4F20` | SoSoValue primary |
| `#7F2711` | SoSoValue pueblo |
| `#FF7637` / `#FD7537` | SoDEX accent |
| `#994721` | SoDEX deep |
| `#0A0A0A` `#121212` `#171717` `#262626` | SoDEX ink |
| `#A3A3A3` | SoDEX muted |
| `#1EA858` / `#F24237` | SoDEX gain / loss |

Logo: sentinel aperture (FlowRadar) — concentric arcs + flow tick. Assets in `public/brand/`.

---

## Tests

- `tests/risk-engine.test.ts` — sizing, geometry, shock pause, drawdown  
- `tests/signal.test.ts` — flow scoring, LONG/SHORT/FLAT, thesis text  

---

## Wave 3 notes

See `CHANGELOG.md` → **Wave 3 (since Jul 4 submission)**.  
Do not merge this branch into the default branch until after judging — production remains the prior live site.
