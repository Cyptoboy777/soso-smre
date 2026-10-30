# FlowSentinel

AI **one-person fund desk** for the [AKINDO SoSoValue buildathon Wave 3](https://sosovalue.com) — *Build Your One-Person On-Chain Finance Business with SoSoValue*.

Reads **SoSoValue** ETF flows, hot news and SSI → writes a plain-English daily thesis with confidence → runs a **risk gate** → places a **confirmed SoDEX testnet** limit order → logs an honest **public track record**.

FlowSentinel Wave 3 preview (public): https://flowsentinel-app.vercel.app  
Live production (previous waves, untouched): https://soso-smre.vercel.app  
This Wave 3 work lives on branch `flowsentinel-wave3` (preview / PR — not production).

---

## SoDEX testnet (live)

FlowSentinel places **real SoDEX testnet** EIP-712 orders when `SODEX_ACCOUNT_ID`, `SODEX_API_KEY_NAME`, and `SODEX_API_KEY_PRIVATE_KEY` are set (Preview branch `flowsentinel-wave3` + Development). Without keys the desk stays labelled **DRY-RUN SIMULATED**.

Proven fills / resting orders (account `60539`):

| orderID | status | notes |
|---------|--------|-------|
| 1301909841 | FILLED | MARKET IOC buy ~5.5 USDC; trade 9461764 @ 78619 |
| 1301909840 | NEW | LIMIT buy 0.001 @ 5000 (resting) |

Server cap: max notional **10 USDC** per confirmed order. Risk gate + confirm checkbox remain mandatory. Mainnet is hard-locked out.

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
| `lib/sodex.ts` | SoDEX testnet EIP-712 spot orders (dry-run when keys absent; mainnet hard-locked out) |
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
| `SODEX_ACCOUNT_ID` | Testnet EIP-712 order | Labelled **DRY-RUN** (nothing submitted) |
| `SODEX_API_KEY_NAME` | Testnet EIP-712 order | Labelled **DRY-RUN** |
| `SODEX_API_KEY_PRIVATE_KEY` | API-key wallet pk (never master) | Labelled **DRY-RUN** |
| `FLOWSENTINEL_DEMO_MODE` | Force demo label | Optional (`0`/`1`) |
| `NEXT_PUBLIC_APP_URL` | Absolute links | Preview: `https://flowsentinel-app.vercel.app` |

---

## Voice desk

Multilingual push-to-talk assistant on the Desk (judge mode friendly):

- **STT / TTS:** browser [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) (free, many languages)
- **Languages:** English, Hindi, Spanish, French, Portuguese, Italian, Chinese, Japanese, Korean (+ Auto). Telugu removed.
- **Grounded answers** about thesis, ETF flows, news, risk gate, track record
- **Commands:** “read thesis”, “explain risk”, “refresh thesis”, “ETF flows”, “news”
- **Safety:** voice **never** places orders — explicit Confirm checkbox + click still required
- **LLM:** `GEMINI_API_KEY` when set; otherwise deterministic answers from the live desk snapshot
- Optional heavier STT fallback (not bundled by default): [Xenova/whisper-tiny](https://huggingface.co/Xenova/whisper-tiny) via `@xenova/transformers` (Apache-2.0)

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


## Design credits (inspiration, not copy-paste of proprietary kits)

Visual language and motion patterns were informed by public, license-respecting sources. FlowSentinel code is original; we did not vendor proprietary component source.

| Resource | License | What we took inspiration from |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com) | MIT | Quiet panels, focus rings, composition |
| [Magic UI](https://magicui.design) | MIT | Tasteful Motion entrances / stagger |
| [Origin UI](https://originui.com) | MIT | Dense app chrome, metric chips |
| [Tremor](https://tremor.so) | Apache-2.0 | Dashboard metric hierarchy |
| [Motion](https://motion.dev) (`framer-motion`) | MIT | Springs, reduced-motion, list stagger |
| Aceternity UI | Free personal/commercial use (no resale as a lib) | Hero energy — patterns only, no pasted blocks |
| Hyperliquid / Linear-style trading UIs | N/A (look & feel) | Restraint, tabular numbers, calm density |

Brand colours are from SoSoValue / SoDEX public sites (see Brand section).


## SoDEX testnet orders (optional)

FlowSentinel is hard-locked to SoDEX **testnet** (`testnet-gw.sodex.dev`, chainId `138565`). There is no mainnet path.

Orders use EIP-712 (`ExchangeAction` / spot domain) with:
- `X-API-Key` = registered key **name**
- `X-API-Sign` = `0x01` + signature from the **API-key wallet** private key
- `X-API-Nonce` = millisecond timestamp

Without `SODEX_ACCOUNT_ID` + `SODEX_API_KEY_NAME` + `SODEX_API_KEY_PRIVATE_KEY`, the desk clearly labels the path as **DRY-RUN** and does not submit.

To register a testnet API key on **your own PC** (never on a shared agent box, never paste master keys into chat):

```bash
npx tsx scripts/register-testnet-api-key.ts
```

That script generates a fresh API-key wallet, has your master wallet sign `AddAPIKey` for testnet only, and writes secrets to a local `*.secret.txt` file (never printed). Copy the three `SODEX_*` lines into `.env`, then delete the secret file.


## Open-source credits (voice + 3D)

Free tools only — no paid voice APIs.

| Project | Licence | Use |
| --- | --- | --- |
| [kokoro-js](https://github.com/hexgrad/kokoro) / Kokoro-82M | Apache-2.0 | Natural English TTS in-browser (WebGPU/WASM) |
| [@mintplex-labs/piper-tts-web](https://github.com/Mintplex-Labs/piper-tts-web) + [Piper](https://github.com/rhasspy/piper) voices | MIT | Hindi and Romance-language TTS |
| [@huggingface/transformers](https://github.com/huggingface/transformers.js) + Whisper tiny | Apache-2.0 | Multilingual STT in-browser |
| [three.js](https://github.com/mrdoob/three.js) + [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) + [postprocessing](https://github.com/pmndrs/postprocessing) | MIT | Voice orb + hero capital-flow scene |
| [Lenis](https://github.com/darkroomengineering/lenis) | MIT | Smooth scroll |
| [Framer Motion](https://github.com/motiondivision/motion) | MIT | UI motion / reduced-motion aware |
| Web Speech API | Browser | Last-resort TTS/STT fallback |

Voice mode never places orders. Models lazy-load on first open with a progress bar and browser cache.
