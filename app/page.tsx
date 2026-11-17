'use client';

/**
 * SoSwapDEX — a non-custodial trading interface for the public SoDEX spot CLOB (ValueChain).
 *
 * Stack: Next.js (app router) · React 18/19 · TypeScript · Tailwind CSS · lucide-react. No other dependencies
 * (keccak256 + secp256k1 signing are implemented in this file and verified against viem).
 *
 * DATA: every price, pair, balance and order comes from the SoDEX gateway (mainnet by default). There is no
 * simulated data: if a request fails the UI shows the error and a retry. Network switch (mainnet/testnet) is in Settings.
 *
 * KEYS: the wallet only signs (a) read-free session connection and (b) one UserSignedAddAPIKeyAction message that registers a
 * API key used for trading. That key's private key lives in this browser tab (sessionStorage) and signs orders locally.
 * Treat it as a hot key (its permissions are set by SoDEX, not by this app). You can also import a key created at sodex.com/apikeys.
 *
 * Server routes (app/api): /api/sodex (gateway pass-through), /api/soso (SoSoValue, key stays server-side), /api/assistant, /api/route (cross-chain quotes; Relay key stays server-side, LI.FI is the no-key fallback).
 */

import AnimalOrb from '@/components/AnimalFace';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import MotionPage from '@/components/motion/MotionPage';
import AnimatedCard from '@/components/motion/AnimatedCard';
import AnimatedTabs from '@/components/motion/AnimatedTabs';
import Reveal from '@/components/motion/Reveal';
import SwapFeedback from '@/components/motion/SwapFeedback';
import { drawShareCard, canvasToBlob, SHARE_W, SHARE_H, type ShareData } from '@/components/shareCard';
import { WC_PROJECT_ID, connectWalletConnect, restoreWalletConnect } from '@/components/walletconnect';
import { InstallButton } from '@/components/Pwa';
import { WalletGlyph, OfficialMark, resolveWalletKind } from '@/components/WalletLogos';
import { SkillsMark, TradeCheckIcon, PositionIcon, PortfolioIcon, BriefIcon, NewsIcon, PlanIcon, JournalIcon, AlertIcon, SkillTile } from '@/components/SkillIcons';
import { scanTrade, sizePosition, portfolioHealth, journalStats, type Grade, type Flag, type ScanOut } from '@/lib/risk';
import { computeSetup, pickBest, assetAliases, etfAssetFor, MAX_SPREAD_PCT, MAX_IMPACT_PCT, type SetupOut, type SetupGrade } from '@/lib/setup';
import {
  buildUserSignedAddApiKey, friendlySodexError, isKeyGone, isUnrecognizedChain, isUserRejected,
  keyListed, keySlots, KEYS_AT_CAP, looksLikeRawSodex, REGISTER_KEY_FAILED, userFacingError, walletActionError,
  wrapUniversalSignature,
} from '@/lib/sodex-keys';
import { parsePerpsBalances, marginUsd, type MarginBalance } from '@/lib/sodex-balances';
import {
  assetsForToken, bestDestination, cheapestWithdraw, evmDestinationsFor, findAsset,
  minDepositGate, tokensWithWithdrawOptions, totalWithdrawFee, CHAIN_LABEL, STABLECOINS, type SodexAsset,
} from '@/lib/sodexConfig';
import { toSmallest } from '@/lib/routes/amount';
import { CHAIN_META, QUOTE_CHAIN_IDS, explorerTx, findRouteToken } from '@/lib/routes/tokens';
import {
  ESTIMATE_NOTE, FRIENDLY_BAD_RECIPIENT, FRIENDLY_NO_ROUTE,
  type NormalizedQuote, type NormalizedStatus, type RouteProvider, type RouteStatusValue, type RouteStep,
} from '@/lib/routes/types';
import { loadSavedRoute, savedFromQuote, storeSavedRoute, type SavedRoute } from '@/lib/routes/persist';
import {
  UNKNOWN_SIG_MSG, allowanceCalldata, approvalStep, friendlyExecError, needsApproval,
  nextPollMs, statusLabel, txParams,
} from '@/lib/routes/execute';
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownUp, ArrowUpRight, Bot, CalendarClock, Check, ChevronDown, Copy, ExternalLink,
  Grid3x3, History, Info, KeyRound, Layers, LineChart, Loader2, LogOut, Plug, Plus, RefreshCw, Search,
  Settings, ShieldCheck, Star, Timer, Trash2, TrendingDown, TrendingUp, Wallet, X, Square, Play, Repeat,
  Home, BarChart3, Link2, BookOpen, Newspaper, Pencil, Zap, ChevronRight, Coins, Menu, Sparkles, Target,
} from 'lucide-react';

declare global {
  interface Window { ethereum?: any }
}

/* ═════════════════════════ constants ═════════════════════════ */

type Net = 'mainnet' | 'testnet';
const NETS: Record<Net, { host: string; chainId: number; label: string }> = {
  mainnet: { host: 'https://mainnet-gw.sodex.dev', chainId: 286623, label: 'Mainnet' },
  testnet: { host: 'https://testnet-gw.sodex.dev', chainId: 138565, label: 'Testnet' },
};
// Browser traffic goes through this app's own /api/sodex proxy (no CORS issues, nothing secret involved).
// NEXT_PUBLIC_SODEX_DIRECT=1 makes the browser call the SoDEX gateway directly. process.env is read literally so Next inlines it.
const DIRECT: boolean = (() => {
  try { return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SODEX_DIRECT === '1'; } catch { return false; }
})();
/** ValueChain mainnet as published in SoDEX's support docs (chain id 286623, native token SOSO). */
const VALUECHAIN = {
  chainId: '0x' + (286623).toString(16), chainName: 'ValueChain',
  nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
  rpcUrls: ['https://mainnet.valuechain.xyz'], blockExplorerUrls: ['https://main-scan.valuechain.xyz'],
};
/* Builder code (SoDEX builder program, https://www.buildsoso.xyz): orders carry the app's builder id + fee; each user approves a max fee once.
 * NEXT_PUBLIC_BUILDER_ID  = this app's SoDEX account id (the builder id). Unset/0 disables the feature entirely.
 * NEXT_PUBLIC_BUILDER_FEE = requested fee in tenths of a basis point (10 = 1 bp = 0.01%). Spot cap is 2000. */
const BUILDER_ID: number = (() => {
  try { const n = Number(process.env.NEXT_PUBLIC_BUILDER_ID ?? 0); return Number.isInteger(n) && n > 0 ? n : 0; } catch { return 0; }
})();
const BUILDER_FEE: number = (() => {
  try { const n = Number(process.env.NEXT_PUBLIC_BUILDER_FEE ?? 30); return Number.isInteger(n) && n >= 1 && n <= 2000 ? n : 30; } catch { return 30; }
})();
const bpText = (tenthsBp: number) => `${(tenthsBp / 10).toFixed(tenthsBp % 10 ? 1 : 0)} bp (${(tenthsBp / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%)`;
const SODEX_SITE = 'https://sodex.com';
const KEY_TTL_MS = 24 * 3600 * 1000; // API key lifetime used by the docs' registration example
const DEADMAN_MS = 60_000; // schedule-cancel horizon, re-armed every 10s
const QUOTE = 'vUSDC';

const DISCLAIMER =
  'SoSwapDEX is an independent service built on the public SoDEX API and is not operated by SoDEX. Trading carries risk, including loss of the capital you commit. Trading volume has a cost; points, Treasure Boxes and fee tiers are set by SoDEX and can change. Nothing here is investment advice.';

/* ═════════════════════════ types ═════════════════════════ */

type Sym = {
  id: number; name: string; display: string; base: string; baseCoin: string; baseCoinId: number; quoteCoinId: number;
  tick: string; step: string; minQty: string; minNotional: string; marketMinQty: string;
  maker: number; taker: number; halted: boolean; qtyPrec: number; pricePrec: number;
};
type Ticker = { symbol: string; last: number; open: number; high: number; low: number; vol: number; quoteVol: number; changePct: number; bid: number; ask: number };
type Coin = { id: number; name: string; precision: number };
type Balance = { id: number; coin: string; total: number; locked: number };
type OpenOrder = {
  symbol: string; orderID: number; clOrdID: string; side: string; type: string; tif: string;
  price?: number; qty?: number; executed: number; status: string; createdAt: number;
};
type Fill = { symbol: string; tradeID: number; orderID: number; clOrdID: string; side: string; price: number; qty: number; fee: number; feeCoin: string; time: number; maker: boolean };
type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
type Level = { price: number; size: number };
type TradeKey = { name: string; pk: string; address: string; accountID: number; expiresAt: number; net: Net; owner: string };
type Asset = { key: string; coin: string; symbol: Sym | null; isQuote: boolean };

/* ═════════════════════════ utils ═════════════════════════ */

const num = (n: number, d = 4) => (isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '–');
const usd = (n: number, d = 2) => (isFinite(n) ? (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
const compact = (n: number) => (isFinite(n) ? Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n) : '–');
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const px = (n: number) => (!isFinite(n) ? '–' : n >= 1000 ? num(n, 2) : n >= 1 ? num(n, 4) : n >= 0.01 ? num(n, 5) : num(n, 8));
const decimalsOf = (step: string) => { const i = step.indexOf('.'); return i < 0 ? 0 : step.length - i - 1; };
const stripZeros = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s) || '0';
/** Floor to the exchange step with no trailing zeros (the API rejects "0.4060"). */
const floorStep = (x: number, step: string) => {
  const st = Number(step);
  const n = Math.floor(x / st + 1e-9);
  return stripZeros((n * st).toFixed(decimalsOf(step)));
};
const roundTick = (x: number, tick: string) => stripZeros((Math.round(x / Number(tick)) * Number(tick)).toFixed(decimalsOf(tick)));
const fixedStr = (x: number, dec: number) => stripZeros((Math.floor(x * 10 ** dec + 1e-9) / 10 ** dec).toFixed(dec));
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const uid = (p = 'ss') => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const asNum = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0; };
const lsGet = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const ssGet = <T,>(k: string, d: T): T => { try { const v = sessionStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const ssSet = (k: string, v: unknown) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ═════════════════════════ crypto (dependency-free) ═════════════════════════
 * keccak256 + secp256k1 deterministic signing (RFC 6979) + EIP-712 ExchangeAction digest.
 * Needed because SoDEX trading requests are signed locally by an API key.
 * Verified against viem in the build step (hashes, addresses, signatures byte-for-byte).
 */

const MASK64 = (1n << 64n) - 1n;
const KECCAK_RC: bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const KECCAK_ROTC = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];
const KECCAK_PILN = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];
const rotl64 = (x: bigint, n: number) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;

function keccakF(st: bigint[]) {
  const bc: bigint[] = new Array(5).fill(0n);
  for (let round = 0; round < 24; round++) {
    for (let i = 0; i < 5; i++) bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
    for (let i = 0; i < 5; i++) {
      const t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
      for (let j = 0; j < 25; j += 5) st[j + i] ^= t;
    }
    let t = st[1];
    for (let i = 0; i < 24; i++) {
      const j = KECCAK_PILN[i];
      const b0 = st[j];
      st[j] = rotl64(t, KECCAK_ROTC[i]);
      t = b0;
    }
    for (let j = 0; j < 25; j += 5) {
      for (let i = 0; i < 5; i++) bc[i] = st[j + i];
      for (let i = 0; i < 5; i++) st[j + i] ^= ~bc[(i + 1) % 5] & MASK64 & bc[(i + 2) % 5];
    }
    st[0] ^= KECCAK_RC[round];
  }
}

function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  padded.set(data);
  padded[data.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;
  const st: bigint[] = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
      st[i] ^= lane;
    }
    keccakF(st);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = st[i];
    for (let b = 0; b < 8; b++) { out[i * 8 + b] = Number(lane & 0xffn); lane >>= 8n; }
  }
  return out;
}

/* ───────── byte helpers ───────── */

const utf8 = (s: string) => new TextEncoder().encode(s);
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string): Uint8Array => {
  const s = h.startsWith('0x') ? h.slice(2) : h;
  if (s.length % 2 || /[^0-9a-fA-F]/.test(s)) throw new Error('bad hex');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const concat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};
const bigToBytes32 = (n: bigint) => fromHex(n.toString(16).padStart(64, '0'));
const bytesToBig = (b: Uint8Array) => (b.length ? BigInt('0x' + toHex(b)) : 0n);

/* ───────── secp256k1 ───────── */

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
type Pt = { x: bigint; y: bigint; z: bigint }; // Jacobian

const mod = (a: bigint, m: bigint = P) => { const r = a % m; return r >= 0n ? r : r + m; };
function inv(a: bigint, m: bigint = P): bigint {
  let [lo, hi] = [mod(a, m), m];
  let [x0, x1] = [1n, 0n];
  while (lo > 1n) {
    const q = hi / lo;
    [hi, lo] = [lo, hi - q * lo];
    [x1, x0] = [x0, x1 - q * x0];
  }
  return mod(x0, m);
}

function jDouble(p: Pt): Pt {
  if (p.y === 0n || p.z === 0n) return { x: 0n, y: 1n, z: 0n };
  const ysq = mod(p.y * p.y);
  const s = mod(4n * p.x * ysq);
  const m = mod(3n * p.x * p.x);
  const x = mod(m * m - 2n * s);
  const y = mod(m * (s - x) - 8n * ysq * ysq);
  const z = mod(2n * p.y * p.z);
  return { x, y, z };
}
function jAdd(p: Pt, q: Pt): Pt {
  if (p.z === 0n) return q;
  if (q.z === 0n) return p;
  const z1z1 = mod(p.z * p.z), z2z2 = mod(q.z * q.z);
  const u1 = mod(p.x * z2z2), u2 = mod(q.x * z1z1);
  const s1 = mod(p.y * q.z * z2z2), s2 = mod(q.y * p.z * z1z1);
  if (u1 === u2) return s1 === s2 ? jDouble(p) : { x: 0n, y: 1n, z: 0n };
  const h = mod(u2 - u1), r = mod(s2 - s1);
  const h2 = mod(h * h), h3 = mod(h * h2), v = mod(u1 * h2);
  const x = mod(r * r - h3 - 2n * v);
  const y = mod(r * (v - x) - s1 * h3);
  const z = mod(p.z * q.z * h);
  return { x, y, z };
}
function mulG(k: bigint): { x: bigint; y: bigint } {
  let result: Pt = { x: 0n, y: 1n, z: 0n };
  let add: Pt = { x: GX, y: GY, z: 1n };
  let n = k;
  while (n > 0n) {
    if (n & 1n) result = jAdd(result, add);
    add = jDouble(add);
    n >>= 1n;
  }
  const zi = inv(result.z);
  const zi2 = mod(zi * zi);
  return { x: mod(result.x * zi2), y: mod(result.y * zi2 * zi) };
}

function randomPrivateKey(): string {
  for (;;) {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    const k = bytesToBig(b);
    if (k > 0n && k < N) return '0x' + toHex(b);
  }
}
function isValidPrivateKey(pk: string): boolean {
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) return false;
  const k = BigInt(pk);
  return k > 0n && k < N;
}
function addressFromPrivateKey(pk: string): string {
  const pub = mulG(BigInt(pk));
  const h = keccak256(concat(bigToBytes32(pub.x), bigToBytes32(pub.y)));
  return '0x' + toHex(h.slice(12));
}

async function hmac(key: Uint8Array, ...parts: Uint8Array[]): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, concat(...parts) as BufferSource));
}

/** Deterministic (RFC 6979) ECDSA over a 32-byte digest. Returns r||s||v with v in {0,1} and low-s. */
async function signDigest(pk: string, digest: Uint8Array): Promise<string> {
  const x = bigToBytes32(BigInt(pk));
  const h1 = bigToBytes32(mod(bytesToBig(digest), N));
  let v: Uint8Array = new Uint8Array(32).fill(1);
  let k: Uint8Array = new Uint8Array(32).fill(0);
  k = await hmac(k, v, Uint8Array.of(0), x, h1);
  v = await hmac(k, v);
  k = await hmac(k, v, Uint8Array.of(1), x, h1);
  v = await hmac(k, v);
  const z = bytesToBig(digest);
  const d = BigInt(pk);
  for (let i = 0; i < 100; i++) {
    v = await hmac(k, v);
    const cand = bytesToBig(v);
    if (cand > 0n && cand < N) {
      const R = mulG(cand);
      const r = mod(R.x, N);
      let s = mod(inv(cand, N) * (z + r * d), N);
      if (r !== 0n && s !== 0n) {
        let rec = Number(R.y & 1n) | (R.x >= N ? 2 : 0);
        if (s > N >> 1n) { s = N - s; rec ^= 1; }
        return '0x' + toHex(concat(bigToBytes32(r), bigToBytes32(s), Uint8Array.of(rec)));
      }
    }
    k = await hmac(k, v, Uint8Array.of(0));
    v = await hmac(k, v);
  }
  throw new Error('signing failed');
}

/* ───────── EIP-712: ExchangeAction(bytes32 payloadHash,uint64 nonce) ───────── */

const ZERO32 = new Uint8Array(32);
const u64 = (n: number | bigint) => bigToBytes32(BigInt(n));
const DOMAIN_TYPEHASH = keccak256(utf8('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'));
const EXCHANGE_TYPEHASH = keccak256(utf8('ExchangeAction(bytes32 payloadHash,uint64 nonce)'));

function domainSeparator(name: string, chainId: number): Uint8Array {
  return keccak256(concat(DOMAIN_TYPEHASH, keccak256(utf8(name)), keccak256(utf8('1')), u64(chainId), ZERO32));
}
function exchangeActionDigest(domainName: 'spot' | 'futures', chainId: number, payloadHash: Uint8Array, nonce: number): Uint8Array {
  const structHash = keccak256(concat(EXCHANGE_TYPEHASH, payloadHash, u64(nonce)));
  return keccak256(concat(Uint8Array.of(0x19, 0x01), domainSeparator(domainName, chainId), structHash));
}

/** Build the X-API-Sign header + hash for a SoDEX action signed by an API key. */
async function signExchangeAction(opts: {
  pk: string; domain: 'spot' | 'futures'; chainId: number; payloadJson: string; nonce: number;
}): Promise<{ header: string; payloadHash: string }> {
  const payloadHash = keccak256(utf8(opts.payloadJson));
  const digest = exchangeActionDigest(opts.domain, opts.chainId, payloadHash, opts.nonce);
  const sig = await signDigest(opts.pk, digest);
  return { header: '0x01' + sig.slice(2), payloadHash: '0x' + toHex(payloadHash) };
}

/* ═════════════════════════ SoDEX REST client ═════════════════════════
 * Paths and payloads follow docs.sodex.com and the official Go SDK (sodex-tech/sodex-go-sdk-public).
 */

class ApiError extends Error {
  code: number;
  raw?: string;
  constructor(message: string, code = -1, raw?: string) { super(message); this.code = code; this.raw = raw; }
}

const apiBase = (net: Net) => (DIRECT ? `${NETS[net].host}/api/v1` : `/api/sodex/${net}/api/v1`);
let clockOffset = 0; // server clock − local clock (ms); keeps nonces inside the accepted window
const serverNow = () => Date.now() + clockOffset;
let lastNonce = 0;
const nextNonce = () => { const n = Math.max(serverNow(), lastNonce + 1); lastNonce = n; return n; };

const RETRYABLE = new Set([429, 502, 503, 504]);
async function request<T>(net: Net, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const isRead = !init.method || init.method === 'GET';
  // Reads get one automatic retry on a timeout, a network drop or a gateway hiccup (cold start, flaky mobile data).
  const attempts = isRead ? 2 : 1;
  let lastErr: ApiError | null = null;
  for (let a = 0; a < attempts; a++) {
    if (a > 0) await new Promise((r) => setTimeout(r, 400));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? (a === 0 ? 9_000 : 14_000));
    const onAbort = () => ctrl.abort();
    init.signal?.addEventListener('abort', onAbort);
    let res: Response;
    try {
      res = await fetch(apiBase(net) + path, { ...init, signal: ctrl.signal });
    } catch (e: any) {
      if (init.signal?.aborted) throw e;
      lastErr = new ApiError(
        e?.name === 'AbortError'
          ? 'SoDEX is slow to answer right now. Please try again.'
          : 'Could not reach SoDEX. Check your connection and try again.',
      );
      continue;
    } finally { clearTimeout(timer); init.signal?.removeEventListener('abort', onAbort); }
    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }
    if (json && typeof json.timestamp === 'number') clockOffset = json.timestamp - Date.now();
    if (!res.ok && RETRYABLE.has(res.status)) {
      lastErr = new ApiError(res.status === 429 ? 'Too many requests. Please wait a few seconds and try again.' : 'SoDEX is busy right now. Please try again.', -1);
      if (res.status === 429) break;
      continue;
    }
    if (!res.ok || (json && typeof json.code === 'number' && json.code !== 0)) {
      const raw = String(json?.error ?? json?.message ?? `SoDEX could not complete this request (${res.status}).`);
      console.warn('[sodex]', res.status, json?.code ?? '', raw);
      throw new ApiError(friendlySodexError(raw), Number(json?.code ?? res.status), raw);
    }
    return (json && 'data' in json ? json.data : json) as T;
  }
  throw lastErr ?? new ApiError('Could not reach SoDEX. Please try again.');
}

const list = <T,>(d: any, ...keys: string[]): T[] => {
  if (Array.isArray(d)) return d as T[];
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k] as T[];
  return [];
};

/* ───────── public market data ───────── */

async function fetchSymbols(net: Net): Promise<Sym[]> {
  const raw = list<any>(await request(net, '/spot/markets/symbols'), 'symbols');
  return raw
    .filter((s) => s && s.quoteCoin === QUOTE)
    .map((s): Sym => ({
      id: Number(s.id), name: String(s.name), display: String(s.displayName ?? s.name),
      base: String(s.displayName ?? s.name).split('/')[0], baseCoin: String(s.baseCoin),
      baseCoinId: Number(s.baseCoinID), quoteCoinId: Number(s.quoteCoinID),
      tick: String(s.tickSize), step: String(s.stepSize), minQty: String(s.minQuantity ?? '0'),
      minNotional: String(s.minNotional ?? '5'), marketMinQty: String(s.marketMinQuantity ?? s.minQuantity ?? '0'),
      maker: asNum(s.makerFee), taker: asNum(s.takerFee), halted: String(s.status).toUpperCase() !== 'TRADING',
      qtyPrec: Number(s.quantityPrecision ?? decimalsOf(String(s.stepSize))), pricePrec: Number(s.pricePrecision ?? decimalsOf(String(s.tickSize))),
    }));
}
async function fetchCoins(net: Net): Promise<Coin[]> {
  return list<any>(await request(net, '/spot/markets/coins'), 'coins').map((c) => ({ id: Number(c.id), name: String(c.name), precision: Number(c.precision) }));
}
async function fetchTickers(net: Net): Promise<Record<string, Ticker>> {
  const out: Record<string, Ticker> = {};
  list<any>(await request(net, '/spot/markets/tickers'), 'tickers').forEach((t) => {
    out[String(t.symbol)] = {
      symbol: String(t.symbol), last: asNum(t.lastPx), open: asNum(t.openPx), high: asNum(t.highPx), low: asNum(t.lowPx),
      vol: asNum(t.volume), quoteVol: asNum(t.quoteVolume), changePct: asNum(t.changePct), bid: asNum(t.bidPx), ask: asNum(t.askPx),
    };
  });
  return out;
}
async function fetchBook(net: Net, symbol: string, limit = 20): Promise<{ bids: Level[]; asks: Level[] }> {
  const d: any = await request(net, `/spot/markets/${encodeURIComponent(symbol)}/orderbook?limit=${limit}`);
  const toL = (a: any[]): Level[] => (a ?? []).map((x) => ({ price: asNum(x[0]), size: asNum(x[1]) })).filter((l) => l.price > 0);
  return { bids: toL(d.bids).sort((a, b) => b.price - a.price), asks: toL(d.asks).sort((a, b) => a.price - b.price) };
}
async function fetchKlines(net: Net, symbol: string, interval: string, limit = 120): Promise<Candle[]> {
  const raw = list<any>(await request(net, `/spot/markets/${encodeURIComponent(symbol)}/klines?interval=${interval}&limit=${limit}`), 'klines', 'candles');
  return raw.map((c) => ({ t: asNum(c.t), o: asNum(c.o), h: asNum(c.h), l: asNum(c.l), c: asNum(c.c), v: asNum(c.v) })).sort((a, b) => a.t - b.t);
}
async function fetchPublicTrades(net: Net, symbol: string, limit = 30): Promise<{ price: number; qty: number; side: string; time: number }[]> {
  return list<any>(await request(net, `/spot/markets/${encodeURIComponent(symbol)}/trades?limit=${limit}`), 'trades').map((t) => ({
    price: asNum(t.price ?? t.p), qty: asNum(t.quantity ?? t.qty ?? t.q), side: String(t.side ?? t.S ?? ''), time: asNum(t.time ?? t.T ?? t.timestamp),
  }));
}

/* ───────── account data (public, address only) ───────── */

async function fetchAccountId(net: Net, address: string): Promise<number | null> {
  try {
    const d: any = await request(net, `/spot/accounts/${address}/state`);
    const aid = Number(d?.aid ?? d?.accountID);
    return aid > 0 ? aid : null;
  } catch (e) {
    if (e instanceof ApiError && e.code === -1) throw e; // network problems should surface; "no account" should not
    return null;
  }
}
async function fetchBalances(net: Net, address: string, aid?: number): Promise<Balance[]> {
  const q = aid ? `?accountID=${aid}` : '';
  return list<any>(await request(net, `/spot/accounts/${address}/balances${q}`), 'balances').map((b) => ({
    id: Number(b.id), coin: String(b.coin), total: asNum(b.total), locked: asNum(b.locked),
  }));
}
/** Public read. Perps/margin funds are not spendable for spot swaps. */
async function fetchPerpsBalances(net: Net, address: string): Promise<MarginBalance[]> {
  return parsePerpsBalances(await request(net, `/perps/accounts/${address}/balances`));
}
const toOrder = (o: any): OpenOrder => ({
  symbol: String(o.symbol ?? o.s ?? ''), orderID: Number(o.orderID ?? o.i ?? 0), clOrdID: String(o.clOrdID ?? o.c ?? ''),
  side: String(o.side ?? o.S ?? ''), type: String(o.type ?? ''), tif: String(o.timeInForce ?? ''),
  price: o.price != null ? asNum(o.price) : undefined, qty: o.origQty != null ? asNum(o.origQty) : o.quantity != null ? asNum(o.quantity) : undefined,
  executed: asNum(o.executedQty ?? o.z), status: String(o.status ?? o.X ?? ''), createdAt: asNum(o.createdAt ?? o.T),
});
async function fetchOpenOrders(net: Net, address: string, aid?: number): Promise<OpenOrder[]> {
  const q = aid ? `?accountID=${aid}` : '';
  return list<any>(await request(net, `/spot/accounts/${address}/orders${q}`), 'orders').map(toOrder);
}
async function fetchOrderHistory(net: Net, address: string, symbol?: string, limit = 100, aid?: number): Promise<OpenOrder[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (symbol) q.set('symbol', symbol);
  if (aid) q.set('accountID', String(aid));
  return list<any>(await request(net, `/spot/accounts/${address}/orders/history?${q}`), 'orders').map(toOrder);
}
async function fetchFills(net: Net, address: string, opts: { symbol?: string; orderID?: number; limit?: number; aid?: number } = {}): Promise<Fill[]> {
  const q = new URLSearchParams({ limit: String(opts.limit ?? 50) });
  if (opts.symbol) q.set('symbol', opts.symbol);
  if (opts.orderID) q.set('orderID', String(opts.orderID));
  if (opts.aid) q.set('accountID', String(opts.aid));
  return list<any>(await request(net, `/spot/accounts/${address}/trades?${q}`), 'trades').map((t) => ({
    symbol: String(t.symbol), tradeID: Number(t.tradeID), orderID: Number(t.orderID), clOrdID: String(t.clOrdID ?? ''), side: String(t.side),
    price: asNum(t.price), qty: asNum(t.quantity), fee: asNum(t.fee), feeCoin: String(t.feeCoin ?? ''), time: asNum(t.time), maker: Boolean(t.isMaker),
  }));
}
async function fetchPlans(net: Net, address: string, kind: 'dcas' | 'twaps', aid?: number): Promise<any[]> {
  const q = aid ? `?accountID=${aid}` : '';
  return list<any>(await request(net, `/spot/accounts/${address}/${kind}${q}`), 'dcas', 'twaps', 'orders', 'plans');
}

/* ───────── signed trading requests (API key, local signature) ───────── */

type Side = 1 | 2; // BUY = 1, SELL = 2
const TIF = { GTC: 1, FOK: 2, IOC: 3, GTX: 4 } as const;
const OTYPE = { LIMIT: 1, MARKET: 2 } as const;
type OrderIn = { symbolID: number; clOrdID: string; side: Side; type: 1 | 2; tif: 1 | 2 | 3 | 4; price?: string; quantity?: string; funds?: string };
type OrderResult = { code: number; clOrdID: string; error?: string; orderID?: number };

let onKeyGone: (() => void) | null = null;
async function signedCall<T>(net: Net, key: TradeKey, method: 'POST' | 'DELETE', path: string, type: string, params: object): Promise<T> {
  // A freshly registered key can take a moment to activate on SoDEX; a rejected request placed nothing, so retrying it is safe.
  const fresh = Date.now() - (key.expiresAt - KEY_TTL_MS) < 60_000;
  for (let a = 0; ; a++) {
    try { return await signedCallOnce<T>(net, key, method, path, type, params); }
    catch (e) {
      if (!isKeyGone(e)) throw e;
      if (fresh && a < 3) { await sleep(1500); continue; }
      onKeyGone?.();
      throw new ApiError('Your trading session has ended. Tap Enable trading to start a new one, then try again.', -2);
    }
  }
}
async function signedCallOnce<T>(net: Net, key: TradeKey, method: 'POST' | 'DELETE', path: string, type: string, params: object): Promise<T> {
  const body = JSON.stringify(params);
  const payloadJson = `{"type":${JSON.stringify(type)},"params":${body}}`; // key order = Go struct order, compact
  const nonce = nextNonce();
  const chainId = NETS[net].chainId;
  const { header } = await signExchangeAction({ pk: key.pk, domain: 'spot', chainId, payloadJson, nonce });
  return request<T>(net, `/spot${path}`, {
    method, body,
    headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
      'X-API-Key': key.name, 'X-API-Sign': header, 'X-API-Nonce': String(nonce), 'X-API-Chain': String(chainId),
    },
  });
}

/** Field order matters: symbolID, clOrdID, side, type, timeInForce, price, quantity, funds. */
const orderItem = (o: OrderIn) => {
  const x: Record<string, unknown> = { symbolID: o.symbolID, clOrdID: o.clOrdID, side: o.side, type: o.type, timeInForce: o.tif };
  if (o.price !== undefined) x.price = o.price;
  if (o.quantity !== undefined) x.quantity = o.quantity;
  if (o.funds !== undefined) x.funds = o.funds;
  return x;
};
/** `builder` goes LAST in the batch (id before fee) and is part of the signed payload. Omitted entirely when not approved. */
const placeOrders = (net: Net, key: TradeKey, orders: OrderIn[], builder?: { id: number; fee: number }) => {
  const params: Record<string, unknown> = { accountID: key.accountID, orders: orders.map(orderItem) };
  if (builder) params.builder = { id: builder.id, fee: builder.fee };
  return signedCall<OrderResult[]>(net, key, 'POST', '/trade/orders/batch', 'batchNewOrder', params);
};
const cancelOrders = (net: Net, key: TradeKey, items: { symbolID: number; orderID: number }[]) =>
  signedCall<OrderResult[]>(net, key, 'DELETE', '/trade/orders/batch', 'batchCancelOrder', {
    accountID: key.accountID, cancels: items.map((c) => ({ symbolID: c.symbolID, clOrdID: uid('c'), orderID: c.orderID })),
  });
/** Dead-man's switch: cancels ALL open orders of the account at the given time. Omit the timestamp to clear. */
const scheduleCancel = (net: Net, key: TradeKey, atMs?: number) =>
  signedCall<unknown>(net, key, 'POST', '/trade/orders/schedule-cancel', 'scheduleCancel',
    atMs === undefined ? { accountID: key.accountID } : { accountID: key.accountID, scheduledTimestamp: atMs });
const newTwap = (net: Net, key: TradeKey, p: { symbolID: number; side: Side; quantity: string; minutes: number; randomize: boolean }) =>
  signedCall<any>(net, key, 'POST', '/trade/twaps', 'newTwapOrder', { accountID: key.accountID, symbolID: p.symbolID, side: p.side, quantity: p.quantity, minutes: p.minutes, randomize: p.randomize });
const cancelTwap = (net: Net, key: TradeKey, symbolID: number, orderID: number) =>
  signedCall<any>(net, key, 'DELETE', '/trade/twaps', 'cancelTwapOrder', { accountID: key.accountID, symbolID, orderID });
type DcaKind = 'interval' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
const newDca = (net: Net, key: TradeKey, p: {
  symbolID: number; side: Side; amount: string; kind: DcaKind; hour: number; day?: number; minPrice?: string; maxPrice?: string; randomize: boolean; immediate: boolean;
}) => {
  const schedule: Record<string, unknown> = { kind: p.kind, hour: p.hour };
  if (p.day !== undefined) schedule.day = p.day;
  const params: Record<string, unknown> = { accountID: key.accountID, symbolID: p.symbolID, side: p.side, amount: p.amount, schedule };
  if (p.minPrice) params.minPrice = p.minPrice;
  if (p.maxPrice) params.maxPrice = p.maxPrice;
  params.randomize = p.randomize;
  params.immediate = p.immediate;
  return signedCall<any>(net, key, 'POST', '/trade/dcas', 'newDcaOrder', params);
};
const cancelDca = (net: Net, key: TradeKey, symbolID: number, orderID: number) =>
  signedCall<any>(net, key, 'DELETE', '/trade/dcas', 'cancelDcaOrder', { accountID: key.accountID, symbolID, orderID });

/* ───────── builder fee approval (master wallet signs once; universal EIP-712 domain) ───────── */

/** Max fee (tenths of bp) the user has approved for this app on spot, or 0. */
async function fetchBuilderApproval(net: Net, address: string): Promise<number> {
  const d: any = await request(net, `/user/${address}/builders`);
  const spot: any[] = Array.isArray(d?.spot) ? d.spot : [];
  const mine = spot.find((b) => Number(b?.builderID) === BUILDER_ID);
  return mine ? asNum(mine.feeRate) : 0;
}

async function approveBuilderFee(net: Net, o: {
  address: string; accountID: number; builderID: number; maxFeeRate: number; domainChainId?: number;
  signTyped: (typedDataJson: string) => Promise<string>;
}): Promise<void> {
  const chainId = NETS[net].chainId;
  const nonce = nextNonce();
  const typed = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
      ],
      ApproveBuilderFeeAction: [
        { name: 'chainID', type: 'uint64' }, { name: 'nonce', type: 'uint64' }, { name: 'accountID', type: 'uint64' },
        { name: 'builderID', type: 'uint64' }, { name: 'maxFeeRate', type: 'uint64' },
      ],
    },
    primaryType: 'ApproveBuilderFeeAction',
    domain: { name: 'universal', version: '1', chainId: o.domainChainId ?? chainId, verifyingContract: '0x0000000000000000000000000000000000000000' },
    message: { chainID: String(chainId), nonce: String(nonce), accountID: String(o.accountID), builderID: String(o.builderID), maxFeeRate: String(o.maxFeeRate) },
  };
  const sig = await o.signTyped(JSON.stringify(typed));
  const bytes = fromHex(sig);
  if (bytes.length !== 65) throw new ApiError('Unexpected signature from wallet.');
  if (bytes[64] >= 27) bytes[64] -= 27;
  await request<null>(net, `/user/${o.address}/builders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
      'X-API-Chain': String(o.domainChainId ?? chainId), 'X-API-Sign': '0x02' + toHex(bytes), 'X-API-Nonce': String(nonce),
    },
    body: JSON.stringify({ accountID: o.accountID, builderID: o.builderID, maxFeeRate: o.maxFeeRate }),
  });
}

/* ───────── API-key registration (master wallet signs once) ───────── */

async function fetchApiKeys(net: Net, address: string, aid?: number) {
  const q = aid ? `?accountID=${aid}` : '';
  const d: any = await request(net, `/user/${address}/api-keys${q}`);
  return { spot: list<any>(d, 'spot'), perps: list<any>(d, 'perps') };
}

async function registerApiKey(net: Net, o: {
  address: string; accountID: number; name: string; keyAddress: string; expiresAt: number;
  signatureChainId: number;
  signTyped: (typedDataJson: string) => Promise<string>;
}): Promise<void> {
  const nonce = nextNonce();
  const built = buildUserSignedAddApiKey({
    sodexChainId: NETS[net].chainId,
    signatureChainId: o.signatureChainId,
    accountID: o.accountID,
    name: o.name,
    publicKey: o.keyAddress,
    expiresAt: o.expiresAt,
    nonce,
  });
  const sig = await o.signTyped(JSON.stringify(built.typedData));
  try {
    await request<null>(net, `/user/${o.address}/api-keys`, {
      method: 'POST',
      headers: { ...built.headers, 'X-API-Sign': wrapUniversalSignature(sig) },
      body: JSON.stringify(built.body),
    });
  } catch (e: any) {
    if (isKeyGone(e) || looksLikeRawSodex(String(e?.raw ?? e?.message ?? ''))) {
      throw new ApiError(REGISTER_KEY_FAILED, e?.code ?? -1, e?.raw ?? e?.message);
    }
    throw e;
  }
}

/* ───────── quoting against the live order book ───────── */

/** Selling `qty` base: walk bids. Returns proceeds (quote) and the average price. */
function quoteSell(bids: Level[], qty: number) {
  let left = qty, got = 0;
  for (const l of bids) { const t = Math.min(left, l.size); got += t * l.price; left -= t; if (left <= 1e-12) break; }
  const filled = qty - left;
  return { quote: got, avg: filled > 0 ? got / filled : 0, shortfall: left > 1e-9 };
}
/** Spending `funds` quote: walk asks. Returns base received and the average price. */
function quoteBuy(asks: Level[], funds: number) {
  let left = funds, base = 0;
  for (const l of asks) { const cost = l.size * l.price; const t = Math.min(left, cost); base += t / l.price; left -= t; if (left <= 1e-9) break; }
  const spent = funds - left;
  return { base, avg: base > 0 ? spent / base : 0, shortfall: left > 1e-6 };
}

/* ═════════════════════════ app store (context) ═════════════════════════ */

type View = 'home' | 'swap' | 'markets' | 'cross' | 'bots' | 'skills' | 'guide' | 'portfolio';
type ToastKind = 'ok' | 'err' | 'info';
type WalletInfo = { id: string; name: string; icon?: string; provider: any };
type Connected = { info: WalletInfo; address: string; chainId: number };

type Store = {
  net: Net; setNet: (n: Net) => void;
  syms: Sym[]; coins: Coin[]; tickers: Record<string, Ticker>; marketErr: string | null; marketLoading: boolean; lastTick: number; reloadMarkets: () => void;
  assets: Asset[]; assetByKey: Record<string, Asset>; symByName: Record<string, Sym>; symByCoin: Record<string, Sym>;
  wallets: WalletInfo[]; wallet: Connected | null; connect: (w: WalletInfo) => Promise<void>; connectWC: () => Promise<void>; wcEnabled: boolean; disconnect: () => void;
  accountID: number | null | undefined; balances: Balance[]; openOrders: OpenOrder[]; accountErr: string | null;
  marginBalances: MarginBalance[]; marginErr: string | null; marginLoaded: boolean;
  refreshAccount: () => Promise<{ orders: OpenOrder[]; balances: Balance[] } | null>;
  key: TradeKey | null; keyValid: boolean; createKey: () => Promise<void>; importKey: (name: string, pk: string) => Promise<void>; forgetKey: () => void;
  selected: string; setSelected: (s: string) => void; favs: string[]; toggleFav: (s: string) => void;
  slippage: string; setSlippage: (s: string) => void;
  deadman: boolean; setDeadman: (b: boolean) => void;
  view: View; setView: (v: View) => void;
  ui: { connect: boolean; key: boolean; settings: boolean }; setUi: (k: 'connect' | 'key' | 'settings', v: boolean) => void;
  toast: (kind: ToastKind, text: string) => void; toasts: { id: number; kind: ToastKind; text: string }[];
  place: (orders: OrderIn[]) => Promise<OrderResult[]>; cancel: (items: { symbolID: number; orderID: number }[]) => Promise<OrderResult[]>;
  available: (coin: string) => number;
  priceOf: (coin: string) => number;
  builder: { enabled: boolean; fee: number; approvedFee: number | undefined; active: boolean; approve: () => Promise<void>; revoke: () => Promise<void> };
};

const Ctx = createContext<Store | null>(null);
const useS = () => { const s = useContext(Ctx); if (!s) throw new Error('store'); return s; };

function useWallets() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  useEffect(() => {
    const seen = new Map<string, WalletInfo>();
    const onAnnounce = (e: any) => {
      const d = e.detail; if (!d?.info || !d?.provider) return;
      seen.set(d.info.uuid, { id: d.info.rdns || d.info.uuid, name: d.info.name, icon: d.info.icon, provider: d.provider });
      setWallets(Array.from(seen.values()));
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const t = setTimeout(() => {
      if (!seen.size && window.ethereum) setWallets([{ id: 'injected', name: 'Browser wallet', provider: window.ethereum }]);
    }, 500);
    return () => { window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener); clearTimeout(t); };
  }, []);
  return wallets;
}

const KEY_STORE = 'soswap.key.v1';

function useSoSwapStore(): Store {
  const [net, setNetState] = useState<Net>('mainnet');
  const [view, setView] = useState<View>('home');
  const [ui, setUiState] = useState({ connect: false, key: false, settings: false });
  const [toasts, setToasts] = useState<{ id: number; kind: ToastKind; text: string }[]>([]);
  const [selected, setSelected] = useState('vBTC_vUSDC');
  const [favs, setFavs] = useState<string[]>([]);
  const [slippage, setSlippageState] = useState('0.5');
  const [deadman, setDeadmanState] = useState(false);

  useEffect(() => {
    try { const v = new URLSearchParams(window.location.search).get('view'); if (v && ['swap', 'markets', 'cross', 'bots', 'skills', 'guide'].includes(v)) setView(v as View); } catch { /* ignore */ }
    setNetState(lsGet<Net>('soswap.net', 'mainnet'));
    setFavs(lsGet<string[]>('soswap.favs', []));
    setSlippageState(lsGet<string>('soswap.slip', '0.5'));
    setDeadmanState(lsGet<boolean>('soswap.deadman', false));
  }, []);

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), kind === 'err' ? 7000 : 4500);
  }, []);
  const setUi = useCallback((k: 'connect' | 'key' | 'settings', v: boolean) => setUiState((s) => ({ ...s, [k]: v })), []);
  const setNet = useCallback((n: Net) => { setNetState(n); lsSet('soswap.net', n); }, []);
  const setSlippage = useCallback((s: string) => { setSlippageState(s); lsSet('soswap.slip', s); }, []);
  const setDeadman = useCallback((b: boolean) => { setDeadmanState(b); lsSet('soswap.deadman', b); }, []);
  const toggleFav = useCallback((s: string) => setFavs((f) => { const n = f.includes(s) ? f.filter((x) => x !== s) : [...f, s]; lsSet('soswap.favs', n); return n; }), []);

  /* ───── markets ───── */
  const [syms, setSyms] = useState<Sym[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [marketErr, setMarketErr] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [lastTick, setLastTick] = useState(0);
  const [reloadN, setReloadN] = useState(0);
  const reloadMarkets = useCallback(() => setReloadN((n) => n + 1), []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setMarketLoading(true); setSyms([]); setTickers({});
    const loadStatic = async () => {
      try {
        const [s, c] = await Promise.all([fetchSymbols(net), fetchCoins(net)]);
        if (stop) return;
        setSyms(s); setCoins(c); setMarketErr(null);
        return true;
      } catch (e: any) { if (!stop) setMarketErr(e?.message ?? 'Failed to load markets'); return false; }
    };
    const loop = async (staticOk: boolean) => {
      if (stop) return;
      if (typeof document !== 'undefined' && document.hidden) { timer = setTimeout(() => loop(staticOk), 2000); return; }
      let ok = staticOk;
      if (!ok) ok = !!(await loadStatic());
      if (ok) {
        try { const t = await fetchTickers(net); if (!stop) { setTickers(t); setLastTick(Date.now()); setMarketErr(null); } }
        catch (e: any) { if (!stop) setMarketErr(e?.message ?? 'Failed to load prices'); }
      }
      if (!stop) { setMarketLoading(false); timer = setTimeout(() => loop(ok), ok ? 4000 : 6000); }
    };
    loadStatic().then((ok) => loop(!!ok));
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [net, reloadN]);

  const symByName = useMemo(() => Object.fromEntries(syms.map((s) => [s.name, s])), [syms]);
  const symByCoin = useMemo(() => Object.fromEntries(syms.map((s) => [s.baseCoin, s])), [syms]);
  const assets = useMemo<Asset[]>(() => {
    const rest = syms.map((s): Asset => ({ key: s.base, coin: s.baseCoin, symbol: s, isQuote: false }))
      .sort((a, b) => (tickers[b.symbol!.name]?.quoteVol ?? 0) - (tickers[a.symbol!.name]?.quoteVol ?? 0));
    return syms.length ? [{ key: 'USDC', coin: QUOTE, symbol: null, isQuote: true }, ...rest] : [];
  }, [syms, tickers]);
  const assetByKey = useMemo(() => Object.fromEntries(assets.map((a) => [a.key, a])), [assets]);

  /* ───── wallet ───── */
  const wallets = useWallets();
  const [wallet, setWallet] = useState<Connected | null>(null);
  const listenRef = useRef<{ p: any; acc: any; chain: any } | null>(null);

  const detach = () => {
    const l = listenRef.current;
    if (l) { l.p.removeListener?.('accountsChanged', l.acc); l.p.removeListener?.('chainChanged', l.chain); listenRef.current = null; }
  };
  const attach = (info: WalletInfo) => {
    detach();
    const acc = (a: string[]) => { if (!a?.length) { setWallet(null); lsSet('soswap.wallet', null); } else setWallet((w) => (w ? { ...w, address: a[0] } : w)); };
    const chain = (c: string) => setWallet((w) => (w ? { ...w, chainId: parseInt(c, 16) } : w));
    info.provider.on?.('accountsChanged', acc);
    info.provider.on?.('chainChanged', chain);
    listenRef.current = { p: info.provider, acc, chain };
  };
  const connect = useCallback(async (info: WalletInfo) => {
    const accts: string[] = await info.provider.request({ method: 'eth_requestAccounts' });
    if (!accts?.length) throw new Error('No account returned by the wallet.');
    const chainId = parseInt(await info.provider.request({ method: 'eth_chainId' }), 16);
    attach(info);
    setWallet({ info, address: accts[0], chainId });
    lsSet('soswap.wallet', info.id);
  }, []);
  const disconnect = useCallback(() => {
    const p = wallet?.info.provider;
    if (wallet?.info.id === 'walletconnect' && p?.disconnect) { Promise.resolve(p.disconnect()).catch(() => undefined); }
    detach(); setWallet(null); lsSet('soswap.wallet', null);
  }, [wallet]);

  const connectWC = useCallback(async () => {
    const provider = await connectWalletConnect();
    const info: WalletInfo = { id: 'walletconnect', name: provider.session?.peer?.metadata?.name || 'WalletConnect', icon: provider.session?.peer?.metadata?.icons?.[0], provider };
    await connect(info);
  }, [connect]);

  // silent reconnect to the last wallet (no popup)
  useEffect(() => {
    const last = lsGet<string | null>('soswap.wallet', null);
    if (!last || wallet) return;
    if (last === 'walletconnect') {
      restoreWalletConnect().then(async (provider) => {
        if (!provider) return;
        const info: WalletInfo = { id: 'walletconnect', name: provider.session?.peer?.metadata?.name || 'WalletConnect', icon: provider.session?.peer?.metadata?.icons?.[0], provider };
        const chainId = Number(provider.chainId) || 1;
        attach(info); setWallet({ info, address: provider.accounts[0], chainId });
      });
      return;
    }
    const w = wallets.find((x) => x.id === last);
    if (!w) return;
    (async () => {
      try {
        const accts: string[] = await w.provider.request({ method: 'eth_accounts' });
        if (accts?.length) {
          const chainId = parseInt(await w.provider.request({ method: 'eth_chainId' }), 16);
          attach(w); setWallet({ info: w, address: accts[0], chainId });
        }
      } catch { /* stay disconnected */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  /* ───── account ───── */
  const [accountID, setAccountID] = useState<number | null | undefined>(undefined);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [marginBalances, setMarginBalances] = useState<MarginBalance[]>([]);
  const [marginErr, setMarginErr] = useState<string | null>(null);
  const [marginLoaded, setMarginLoaded] = useState(false);
  const addr = wallet?.address?.toLowerCase();
  const aidRef = useRef<number | null | undefined>(undefined);
  aidRef.current = accountID;

  const refreshAccount = useCallback(async () => {
    if (!addr) return null;
    const spotP = (async () => {
      try {
        let aid = aidRef.current;
        if (aid === undefined || aid === null) {
          aid = await fetchAccountId(net, addr);
          setAccountID(aid);
        }
        if (!aid) { setBalances([]); setOpenOrders([]); setAccountErr(null); return null; }
        const [b, o] = await Promise.all([fetchBalances(net, addr, aid), fetchOpenOrders(net, addr, aid)]);
        setBalances(b); setOpenOrders(o); setAccountErr(null);
        return { orders: o, balances: b };
      } catch (e: any) { setAccountErr(e?.message ?? 'Failed to load account'); return null; }
    })();
    const marginP = (async () => {
      try {
        const m = await fetchPerpsBalances(net, addr);
        setMarginBalances(m);
        setMarginErr(null);
      } catch {
        setMarginErr('Could not load Margin & Futures balances. Please try again.');
      } finally {
        setMarginLoaded(true);
      }
    })();
    const [spot] = await Promise.all([spotP, marginP]);
    return spot;
  }, [addr, net]);

  useEffect(() => {
    setAccountID(undefined); setBalances([]); setOpenOrders([]); setAccountErr(null);
    setMarginBalances([]); setMarginErr(null); setMarginLoaded(false);
    if (!addr) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stop) return;
      if (!(typeof document !== 'undefined' && document.hidden)) await refreshAccount();
      if (!stop) timer = setTimeout(tick, 6000);
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [addr, net, refreshAccount]);

  const available = useCallback((coin: string) => { const b = balances.find((x) => x.coin === coin); return b ? Math.max(0, b.total - b.locked) : 0; }, [balances]);
  const priceOf = useCallback((coin: string) => {
    if (coin === QUOTE) return 1;
    const s = syms.find((x) => x.baseCoin === coin);
    return s ? tickers[s.name]?.last ?? 0 : 0;
  }, [syms, tickers]);

  /* ───── trade key ───── */
  const [key, setKey] = useState<TradeKey | null>(null);
  useEffect(() => { setKey(ssGet<TradeKey | null>(KEY_STORE, null)); }, []);
  const [clock, setClock] = useState(0);
  useEffect(() => { const t = setInterval(() => setClock((c) => c + 1), 30_000); return () => clearInterval(t); }, []);
  // `clock` ticks every 30s so an expiring key is noticed without user interaction
  const keyValid = useMemo(
    () => !!(key && addr && key.owner === addr && key.net === net && key.expiresAt > serverNow() + 30_000 && accountID === key.accountID),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, addr, net, accountID, clock],
  );
  const persistKey = (k: TradeKey | null) => { setKey(k); ssSet(KEY_STORE, k); };
  const forgetKey = useCallback(() => persistKey(null), []);
  useEffect(() => { onKeyGone = () => persistKey(null); return () => { onKeyGone = null; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Read the wallet's live chain id (preferred over the cached value, which can be stale). */
  const readWalletChainId = async (provider: any, fallback?: number) => {
    try {
      const id = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
      if (Number.isFinite(id)) return id;
    } catch { /* use fallback */ }
    return fallback;
  };

  /** Switch (and, on mainnet, add) a chain BEFORE any signature request, so the two prompts never overlap.
   *  MetaMask auto-closes a sign prompt with code 4001 when the typed-data domain chain differs from the active chain. */
  const ensureChain = async (provider: any, targetChainId: number) => {
    const hex = '0x' + targetChainId.toString(16);
    const current = await readWalletChainId(provider);
    if (current === targetChainId) return targetChainId;
    const switchTo = () => provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    try {
      await switchTo();
    } catch (e: any) {
      if (isUserRejected(e)) { const err: any = new Error(walletActionError(e, 'switch')); err.code = 4001; throw err; }
      if (!isUnrecognizedChain(e) && !/chain|network/i.test(String(e?.message ?? ''))) {
        throw new Error(walletActionError(e, 'switch'));
      }
      if (net !== 'mainnet' || targetChainId !== NETS.mainnet.chainId) {
        throw new Error(`Your wallet is not on the network this signature needs (chain ${targetChainId}). Add that network in the wallet and retry, or import an API key created on sodex.com/apikeys.`);
      }
      try {
        await provider.request({ method: 'wallet_addEthereumChain', params: [VALUECHAIN] });
        await switchTo();
      } catch (e2: any) {
        if (isUserRejected(e2)) { const err: any = new Error(walletActionError(e2, 'switch')); err.code = 4001; throw err; }
        throw new Error('Your wallet could not add the ValueChain network (chain id 286623, RPC https://mainnet.valuechain.xyz). Add it manually in the wallet settings and retry.');
      }
    }
    const after = await readWalletChainId(provider, targetChainId);
    if (after !== targetChainId) throw new Error('The wallet is not yet on the required network. Switch to ValueChain and try again.');
    return after;
  };

  /** Signs EIP-712 typed data with the connected wallet (any wallet from the picker, incl. WalletConnect).
   *  If the typed-data domain names a chain, that chain is made active first (one prompt at a time).
   *  Enable trading uses the official UserSignedAddAPIKeyAction form, whose domain chain is the wallet's
   *  current chain, so no switch is needed. Builder-fee approval uses the SoDEX chain in the domain. */
  const walletSign = useCallback(async (json: string) => {
    if (!wallet) throw new Error('Connect a wallet first.');
    const p = wallet.info.provider;
    let target: number | undefined;
    try {
      const id = Number(JSON.parse(json)?.domain?.chainId);
      if (Number.isFinite(id) && id > 0) target = id;
    } catch { /* not JSON; sign as-is */ }
    if (target) await ensureChain(p, target);
    try {
      return await p.request({ method: 'eth_signTypedData_v4', params: [wallet.address, json] }) as Promise<string>;
    } catch (e: any) {
      if (isUserRejected(e)) { const err: any = new Error(walletActionError(e, 'sign')); err.code = 4001; throw err; }
      throw new Error(walletActionError(e, 'sign'));
    }
  }, [wallet, net]); // eslint-disable-line react-hooks/exhaustive-deps

  const createKey = useCallback(async () => {
    if (!wallet || !addr) throw new Error('Connect a wallet first.');
    if (!accountID) throw new Error('No SoDEX account found for this wallet. Deposit on sodex.com first.');
    try {
      const listed = await fetchApiKeys(net, wallet.address, accountID);
      if (keySlots(listed).full) throw new Error(KEYS_AT_CAP);
    } catch (e: any) {
      if (e?.message === KEYS_AT_CAP) throw e;
      // Listing is best-effort: a failure must not block registration.
    }
    const signatureChainId = await readWalletChainId(wallet.info.provider, wallet.chainId);
    if (!signatureChainId) throw new Error('Could not read the wallet network. Reconnect the wallet and try again.');
    const pk = randomPrivateKey();
    const keyAddress = addressFromPrivateKey(pk);
    const name = `soswap-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = serverNow() + KEY_TTL_MS;
    await registerApiKey(net, { address: wallet.address, accountID, name, keyAddress, expiresAt, signatureChainId, signTyped: walletSign });
    persistKey({ name, pk, address: keyAddress, accountID, expiresAt, net, owner: addr });
    for (let i = 0; i < 3; i++) {
      try {
        const listed = await fetchApiKeys(net, wallet.address, accountID);
        if (keyListed(listed, name)) break;
      } catch { /* listing is best-effort */ }
      if (i < 2) await sleep(800);
    }
  }, [wallet, addr, accountID, net, walletSign]);

  const importKey = useCallback(async (name: string, pk: string) => {
    if (!addr) throw new Error('Connect a wallet first.');
    if (!accountID) throw new Error('No SoDEX account found for this wallet.');
    const n = name.trim(); const k = pk.trim().startsWith('0x') ? pk.trim() : '0x' + pk.trim();
    if (!/^[0-9a-zA-Z_-]{1,36}$/.test(n)) throw new Error('Key name may only contain letters, numbers, _ and -.');
    if (!isValidPrivateKey(k)) throw new Error('That is not a valid 32-byte private key.');
    persistKey({ name: n, pk: k, address: addressFromPrivateKey(k), accountID, expiresAt: serverNow() + 365 * 24 * 3600 * 1000, net, owner: addr });
  }, [addr, accountID, net]);

  /* ───── trading actions ───── */
  /* ───── builder fee approval ───── */
  const [approvedFee, setApprovedFee] = useState<number | undefined>(undefined);
  useEffect(() => {
    setApprovedFee(undefined);
    if (!BUILDER_ID || !addr || !accountID) return;
    let stop = false;
    fetchBuilderApproval(net, addr).then((f) => { if (!stop) setApprovedFee(f); }).catch(() => { if (!stop) setApprovedFee(0); });
    return () => { stop = true; };
  }, [addr, accountID, net]);
  const fee = approvedFee ? Math.min(BUILDER_FEE, approvedFee) : 0;
  const approveBuilder = useCallback(async () => {
    if (!wallet || !addr) throw new Error('Connect a wallet first.');
    if (!accountID) throw new Error('No SoDEX account found for this wallet. Deposit on sodex.com first.');
    if (!BUILDER_ID) throw new Error('The app fee is not configured on this deployment.');
    await approveBuilderFee(net, { address: wallet.address, accountID, builderID: BUILDER_ID, maxFeeRate: BUILDER_FEE, signTyped: walletSign });
    setApprovedFee(await fetchBuilderApproval(net, wallet.address).catch(() => BUILDER_FEE));
  }, [wallet, addr, accountID, net, walletSign]);
  const revokeBuilder = useCallback(async () => {
    if (!wallet || !addr || !accountID || !BUILDER_ID) throw new Error('Connect a wallet first.');
    await approveBuilderFee(net, { address: wallet.address, accountID, builderID: BUILDER_ID, maxFeeRate: 0, signTyped: walletSign });
    setApprovedFee(0);
  }, [wallet, addr, accountID, net, walletSign]);
  const builder = useMemo(() => ({ enabled: BUILDER_ID > 0, fee: BUILDER_FEE, approvedFee, active: fee > 0, approve: approveBuilder, revoke: revokeBuilder }),
    [approvedFee, fee, approveBuilder, revokeBuilder]);

  const place = useCallback(async (orders: OrderIn[]) => {
    if (!key || !keyValid) throw new Error('Enable trading first (trade key missing or expired).');
    return placeOrders(net, key, orders, fee > 0 ? { id: BUILDER_ID, fee } : undefined);
  }, [key, keyValid, net, fee]);
  const cancel = useCallback(async (items: { symbolID: number; orderID: number }[]) => {
    if (!key || !keyValid) throw new Error('Enable trading first (trade key missing or expired).');
    return cancelOrders(net, key, items);
  }, [key, keyValid, net]);

  /* ───── dead-man's switch (SoDEX schedule-cancel), re-armed every 10s ───── */
  const wasArmed = useRef(false);
  useEffect(() => {
    if (!key || !keyValid) return;
    if (!deadman) {
      if (wasArmed.current) { wasArmed.current = false; scheduleCancel(net, key).catch(() => undefined); }
      return;
    }
    let stop = false;
    const arm = async () => {
      try { await scheduleCancel(net, key, serverNow() + DEADMAN_MS); wasArmed.current = true; }
      catch (e: any) { if (!stop) toast('err', `Safety switch could not be armed: ${e?.message ?? e}`); }
    };
    arm();
    const id = setInterval(arm, 10_000);
    return () => { stop = true; clearInterval(id); };
  }, [deadman, key, keyValid, net, toast]);

  return {
    net, setNet, syms, coins, tickers, marketErr, marketLoading, lastTick, reloadMarkets,
    assets, assetByKey, symByName, symByCoin,
    wallets, wallet, connect, connectWC, wcEnabled: !!WC_PROJECT_ID, disconnect,
    accountID, balances, openOrders, accountErr, marginBalances, marginErr, marginLoaded, refreshAccount,
    key, keyValid, createKey, importKey, forgetKey, builder,
    selected, setSelected, favs, toggleFav, slippage, setSlippage, deadman, setDeadman,
    view, setView, ui, setUi, toast, toasts, place, cancel, available, priceOf,
  };
}

/* ═════════════════════════ UI primitives ═════════════════════════ */

/** SoSwapDEX mark: an "S" drawn as two swap arrows (orange up-right, white down-left). */
const Logo = ({ size = 36, glow = true }: { size?: number; glow?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="SoSwapDEX" style={glow ? { filter: 'drop-shadow(0 4px 14px rgba(249,115,22,0.55))' } : undefined}>
    <defs>
      <linearGradient id="ssO" x1="12" y1="6" x2="52" y2="34" gradientUnits="userSpaceOnUse"><stop stopColor="#fdba74" /><stop offset=".5" stopColor="#fb923c" /><stop offset="1" stopColor="#ea580c" /></linearGradient>
      <linearGradient id="ssW" x1="52" y1="30" x2="12" y2="60" gradientUnits="userSpaceOnUse"><stop stopColor="#ffffff" /><stop offset="1" stopColor="#a1a1aa" /></linearGradient>
    </defs>
    <path d="M32 33C22 31 18 28 19 22 20 12 36 11 43 17" stroke="url(#ssO)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M55 18 43 8.5v19z" fill="url(#ssO)" stroke="url(#ssO)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M32 31C42 33 46 36 45 42 44 52 28 53 21 47" stroke="url(#ssW)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 46 21 55.500v-19z" fill="url(#ssW)" stroke="url(#ssW)" strokeWidth="3" strokeLinejoin="round" />
  </svg>
);
const Wordmark = () => (
  <span className="text-[17px] font-extrabold tracking-tight text-zinc-50">
    So<span className="bg-gradient-to-r from-orange-300 to-orange-500 bg-clip-text text-transparent">SwapDEX</span>
  </span>
);

/** Real token logos from public icon CDNs (tried in order); a letter avatar is shown only if none has the token. */
const ICON_SOURCES = [
  (s: string) => `https://assets.coincap.io/assets/icons/${s}@2x.png`,
  (s: string) => `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${s}.png`,
  (s: string) => `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${s}.png`,
];
const STOCKS = new Set(['AAPL', 'AMZN', 'GOOGL', 'META', 'MSFT', 'NVDA', 'TSLA', 'QQQ', 'VOO', 'SCHD', 'VGT', 'VYM', 'SMH', 'CRCL', 'STRC', 'BOXX']);
/** Real logo sources, tried in order; the lettered badge is only the last resort when none of them has the token. */
/** Logos CoinCap/spothq don't carry (SoSoValue's own token, tokenised gold). Sourced from CoinGecko's asset CDN. */
const ICON_OVERRIDES: Record<string, string> = {
  SOSO: 'https://assets.coingecko.com/coins/images/53919/standard/soso.jpg?1737717378',
  WSOSO: 'https://assets.coingecko.com/coins/images/53919/standard/soso.jpg?1737717378',
  XAUT: 'https://assets.coingecko.com/coins/images/10481/standard/logo.png?1774627372',
};
const iconSources = (name: string): string[] => {
  const t = name.replace(/^[va](?=[A-Z])/, '').replace(/\..*$/, '').toUpperCase();
  if (ICON_OVERRIDES[t] || ICON_OVERRIDES[name.toUpperCase()]) return [ICON_OVERRIDES[t] ?? ICON_OVERRIDES[name.toUpperCase()]];
  if (STOCKS.has(t)) return [`https://assets.parqet.com/logos/symbol/${t}?format=png`];
  const l = t.toLowerCase();
  return [`https://assets.coincap.io/assets/icons/${l}@2x.png`, `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${l}.png`, `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${l}.png`];
};
const ICON_MISS = new Set<string>();
const TokenIcon = ({ name, size = 28 }: { name: string; size?: number }) => {
  const h = hue(name);
  const srcs = useMemo(() => iconSources(name).filter((u) => !ICON_MISS.has(u)), [name]);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [name]);
  if (i < srcs.length) {
    return (
      <img src={srcs[i]} alt={name} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => { ICON_MISS.add(srcs[i]); setI((n) => n + 1); }}
        className="shrink-0 select-none rounded-full bg-white/[0.06] object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      className="grid shrink-0 select-none place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4), background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 38%))` }}>
      {name.replace(/[^A-Za-z0-9]/g, '').slice(0, name.length > 3 && size >= 30 ? 2 : 1).toUpperCase()}
    </span>
  );
};

const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => <Loader2 className={cx('animate-spin', className)} aria-hidden />;
const Skeleton = ({ className = '' }: { className?: string }) => <div aria-hidden className={cx('ss-skel', className)} />;

/** Live value with a soft green or red wash when it ticks up or down. Pure opacity animation, no layout change. */
function Flash({ v, children, className = '' }: { v: number | undefined; children: React.ReactNode; className?: string }) {
  const prev = useRef<number | undefined>(v);
  const [fx, setFx] = useState<{ n: number; dir: 'up' | 'down' } | null>(null);
  useEffect(() => {
    const was = prev.current; prev.current = v;
    if (v == null || was == null || v === was) return;
    setFx((c) => ({ n: (c?.n ?? 0) + 1, dir: v > was ? 'up' : 'down' }));
  }, [v]);
  return <span className={cx('relative inline-block', className)}>{fx && <i key={fx.n} aria-hidden className={cx('ss-tick-fx', fx.dir === 'up' ? 'ss-tick-up' : 'ss-tick-down')} />}<span className="relative">{children}</span></span>;
}
/** A number that fades in when it changes (a keyed remount; no timers). */
const Num = ({ v }: { v: React.ReactNode }) => <span key={String(v)} className="ss-num">{v}</span>;

const Card = ({ className = '', glow, children }: { className?: string; glow?: boolean; children: React.ReactNode }) => (
  <section className={cx('ss-card', glow && 'ss-card-glow', className)}>{children}</section>
);
const CardHead = ({ title, icon, right }: { title: React.ReactNode; icon?: React.ReactNode; right?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">{icon}{title}</h2>
    {right}
  </div>
);

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'; size?: 'sm' | 'md' | 'lg'; loading?: boolean };
const Button = ({ variant = 'secondary', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) => {
  const v = {
    primary: 'ss-btn-primary bg-gradient-to-b from-orange-400 to-orange-500 text-black',
    secondary: 'border border-white/10 bg-white/[0.04] text-zinc-100 hover:border-white/20 hover:bg-white/[0.08]',
    ghost: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
    danger: 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
    success: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  }[variant];
  const s = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-[15px]' }[size];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx('ss-btn inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400', v, s, className)}>
      {loading && <Spinner className="h-4 w-4" />}{children}
    </button>
  );
};

const Badge = ({ tone = 'zinc', children }: { tone?: 'zinc' | 'amber' | 'emerald' | 'rose'; children: React.ReactNode }) => {
  const t = { zinc: 'bg-white/[0.06] text-zinc-300', amber: 'bg-orange-500/15 text-orange-300', emerald: 'bg-emerald-500/15 text-emerald-300', rose: 'bg-rose-500/15 text-rose-300' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', t)}>{children}</span>;
};

const Notice = ({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: React.ReactNode; action?: React.ReactNode }) => {
  const t = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-200', warn: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
    error: 'border-rose-500/40 bg-rose-500/10 text-rose-200', ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  }[tone];
  const Icon = tone === 'error' || tone === 'warn' ? AlertTriangle : tone === 'ok' ? Check : Info;
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={cx('flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed', t)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1">{children}</div>{action}
    </div>
  );
};

const Modal = ({ open, onClose, title, children, wide, maxW }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean; maxW?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const reduce = useReducedMotion();
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const root = ref.current; if (!root) return;
      const f = Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!f.length) { e.preventDefault(); root.focus(); return; }
      const first = f[0], last = f[f.length - 1], act = document.activeElement;
      if (e.shiftKey && (act === first || act === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => { const r = ref.current; if (r && !r.contains(document.activeElement)) r.focus(); }, 40);
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev; clearTimeout(t); if (back && document.contains(back)) back.focus?.(); };
  }, [open]);
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="scrim" className="ss-scrim fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            initial={reduce ? false : { opacity: 0, y: 28, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: reduce ? 0 : 0.26, ease }}
            className={cx('ss-sheet max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 outline-none sm:rounded-3xl', maxW ?? (wide ? 'sm:max-w-2xl' : 'sm:max-w-md'))}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a090b]/95 px-5 py-4 md:backdrop-blur">
              <h3 id={titleId} className="text-[15px] font-semibold tracking-tight text-zinc-50">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="ss-btn rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Segmented = <T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) => {
  const id = useId();
  const reduce = useReducedMotion();
  const move = (i: number, d: number) => { const n = options[(i + d + options.length) % options.length]; onChange(n.value); };
  return (
    <LayoutGroup id={id}>
      <div role="tablist" className={cx('inline-flex rounded-xl border border-white/[0.07] bg-black/30 p-1', className)}>
        {options.map((o, i) => {
          const on = value === o.value;
          return (
            <button key={o.value} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.value)}
              onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); move(i, 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1); } }}
              className={cx('relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150', on ? 'text-zinc-50' : 'text-zinc-500 hover:text-zinc-200')}>
              {on && <motion.span layoutId="seg-pill" className="absolute inset-0 rounded-lg bg-white/[0.1] shadow-sm" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

/** Decimal input (digits and one dot only). */
const AmountInput = ({ value, onChange, placeholder = '0', className = '', suffix, label, id }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; suffix?: React.ReactNode; label?: string; id?: string }) => (
  <div className={cx('flex items-center rounded-xl border border-white/10 bg-black/30 px-3 transition focus-within:border-orange-500/60', className)}>
    <input id={id} aria-label={label} inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder}
      onChange={(e) => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) onChange(v); }}
      className="tnum h-10 w-full min-w-0 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
    {suffix && <span className="ml-2 shrink-0 text-xs text-zinc-500">{suffix}</span>}
  </div>
);

const Field = ({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-zinc-400"><span>{label}</span>{hint && <span className="font-normal text-zinc-600">{hint}</span>}</span>
    {children}
  </label>
);

const Row = ({ k, v, tone }: { k: React.ReactNode; v: React.ReactNode; tone?: 'good' | 'bad' | 'warn' }) => (
  <div className="flex items-start justify-between gap-4 text-xs">
    <span className="text-zinc-500">{k}</span>
    <span className={cx('tnum text-right', tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : tone === 'warn' ? 'text-orange-300' : 'text-zinc-200')}>{v}</span>
  </div>
);

const Empty = ({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-zinc-500">{icon}</div>
    <div className="text-sm font-semibold text-zinc-200">{title}</div>
    {body && <div className="max-w-sm text-xs leading-relaxed text-zinc-500">{body}</div>}
    {action}
  </div>
);

const Chg = ({ pct }: { pct: number }) => (
  <span className={cx('tnum inline-flex items-center gap-0.5 text-xs font-semibold', pct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
    {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
  </span>
);

const CopyBtn = ({ text }: { text: string }) => {
  const [ok, setOk] = useState(false);
  return (
    <button aria-label="Copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }).catch(() => undefined); }}
      className="rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

/* ═════════════════════════ modals: wallet, trading key, settings, token picker, review ═════════════════════════ */

function BuilderBlock() {
  const S = useS();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); S.toast('ok', ok); }
    catch (e: any) { S.toast('err', userFacingError(e, 'Could not complete the request.')); }
    finally { setBusy(false); }
  };
  const b = S.builder;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Coins className="h-4 w-4 text-orange-400" />SoSwapDEX fee</span>
        <Badge tone={b.active ? 'emerald' : 'zinc'}>{b.active ? 'Approved' : b.approvedFee === undefined ? 'Checking…' : 'Not approved'}</Badge>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">SoSwapDEX earns at most <b className="text-zinc-300">{bpText(b.fee)}</b> of each filled order, on top of SoDEX's own fees. You approve this once with a wallet signature (no gas, no funds move) and can revoke it any time.</p>
      {b.active
        ? <Button size="sm" variant="danger" loading={busy} onClick={() => run(b.revoke, 'SoSwapDEX fee approval revoked.')}>Revoke approval</Button>
        : <Button size="sm" variant="primary" loading={busy} disabled={!S.accountID} onClick={() => run(b.approve, 'SoSwapDEX fee approved.')}>Approve SoSwapDEX fee</Button>}
    </div>
  );
}

function friendlyConnectError(e: any, kind: 'wallet' | 'wc') {
  const code = e?.code;
  const m = String(e?.message ?? e ?? '');
  if (code === 4001 || /reject|denied|closed|cancel/i.test(m)) return 'Connection was cancelled in the wallet.';
  return kind === 'wc' ? 'Could not open WalletConnect. Please try again.' : 'Could not connect. Please try that wallet again.';
}

function WalletModal() {
  const S = useS();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const open = S.ui.connect;
  const close = () => { S.setUi('connect', false); setErr(null); };

  const doConnect = async (w: WalletInfo) => {
    setBusy(w.id); setErr(null);
    try { await S.connect(w); close(); S.toast('ok', `Connected ${w.name}`); }
    catch (e: any) { setErr(friendlyConnectError(e, 'wallet')); }
    finally { setBusy(null); }
  };

  const doConnectWC = async () => {
    setBusy('walletconnect'); setErr(null);
    try { await S.connectWC(); close(); S.toast('ok', 'Connected with WalletConnect'); }
    catch (e: any) { setErr(friendlyConnectError(e, 'wc')); }
    finally { setBusy(null); }
  };

  if (S.wallet) {
    const keyLeft = S.key ? Math.max(0, S.key.expiresAt - Date.now()) : 0;
    return (
      <Modal open={open} onClose={close} title="Wallet">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/30 p-3">
            <WalletGlyph id={S.wallet.info.id} name={S.wallet.info.name} src={S.wallet.info.icon} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-zinc-100">{S.wallet.info.name}</div>
              <div className="tnum flex items-center gap-1 text-xs text-zinc-500">{short(S.wallet.address)}<CopyBtn text={S.wallet.address} /></div>
            </div>
            <Badge tone={S.accountID ? 'emerald' : 'amber'}>{S.accountID ? `Account #${S.accountID}` : S.accountID === undefined ? 'Checking…' : 'No account'}</Badge>
          </div>
          {S.accountID === null && (
            <Notice tone="warn" action={<a className="font-semibold underline" href={SODEX_SITE} target="_blank" rel="noreferrer">Open SoDEX</a>}>
              This wallet has no SoDEX spot account yet. Deposit on SoDEX first, then come back.
            </Notice>
          )}
          <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><KeyRound className="h-4 w-4 text-orange-400" />Trading key</span>
              <Badge tone={S.keyValid ? 'emerald' : 'zinc'}>{S.keyValid ? 'Active' : 'Not enabled'}</Badge>
            </div>
            {S.keyValid && S.key ? (
              <div className="space-y-1.5">
                <Row k="Name" v={S.key.name} />
                <Row k="Expires in" v={`${Math.floor(keyLeft / 3_600_000)}h ${Math.floor((keyLeft % 3_600_000) / 60_000)}m`} />
                <div className="flex gap-2 pt-2"><Button size="sm" variant="danger" onClick={() => { S.forgetKey(); S.toast('info', 'Key removed from this tab.'); }}>Forget key</Button></div>
              </div>
            ) : (
              <Button size="sm" variant="primary" disabled={!S.accountID} onClick={() => { close(); S.setUi('key', true); }}>Enable trading</Button>
            )}
          </div>
          {S.builder.enabled && <BuilderBlock />}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { S.disconnect(); S.forgetKey(); close(); }}><LogOut className="h-4 w-4" />Disconnect</Button>
            <a href={SODEX_SITE} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-zinc-100 hover:bg-white/[0.08]">
              Deposit / Withdraw<ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title="Connect a wallet" maxW="sm:max-w-3xl">
      <ConnectPicker wallets={S.wallets} wcEnabled={S.wcEnabled} busy={busy} err={err} onPick={doConnect} onWC={doConnectWC} />
    </Modal>
  );
}

type PopularWallet = { id: string; name: string; install: string; mobile?: (url: string) => string };
const POPULAR_WALLETS: PopularWallet[] = [
  { id: 'metamask', name: 'MetaMask', install: 'https://metamask.io/download', mobile: (u) => `https://metamask.app.link/dapp/${u.replace(/^https?:\/\//, '')}` },
  { id: 'rabby', name: 'Rabby', install: 'https://rabby.io' },
  { id: 'coinbase', name: 'Coinbase Wallet', install: 'https://www.coinbase.com/wallet/downloads', mobile: (u) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}` },
  { id: 'okx', name: 'OKX Wallet', install: 'https://www.okx.com/web3', mobile: (u) => `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(u)}`)}` },
  { id: 'trust', name: 'Trust Wallet', install: 'https://trustwallet.com/download', mobile: (u) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(u)}` },
  { id: 'rainbow', name: 'Rainbow', install: 'https://rainbow.me/download' },
  { id: 'brave', name: 'Brave Wallet', install: 'https://brave.com/wallet/' },
];

function isDetectedPopular(wallets: WalletInfo[], p: PopularWallet) {
  return wallets.some((w) => resolveWalletKind(w.id, w.name) === p.id || w.name.toLowerCase().includes(p.name.toLowerCase()) || w.id.toLowerCase().includes(p.id));
}

/** Two-pane wallet picker: detected EIP-6963 wallets first (real icons), then popular ones with official logos and install links. */
function ConnectPicker({ wallets, wcEnabled, busy, err, onPick, onWC }: {
  wallets: WalletInfo[]; wcEnabled: boolean; busy: string | null; err: string | null; onPick: (w: WalletInfo) => void; onWC: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setUrl(window.location.origin + '/');
    const ua = navigator.userAgent;
    setMobile(/android|iphone|ipad|ipod|mobile/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1));
  }, []);
  const popular = POPULAR_WALLETS.filter((p) => !isDetectedPopular(wallets, p) && (!mobile || p.mobile));
  const rowCls = 'flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition hover:bg-white/[0.06] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400';
  const group = (t: string) => <div className="mb-1.5 mt-3.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 first:mt-0">{t}</div>;
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,320px)_1fr]">
      <div className="min-w-0">
        {wallets.length > 0 && (<>{group('Installed')}
          {wallets.map((w) => (
            <button key={w.id} type="button" onClick={() => onPick(w)} disabled={!!busy} className={rowCls}>
              <WalletGlyph id={w.id} name={w.name} src={w.icon} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-zinc-50">{w.name}</span>
              {busy === w.id ? <Spinner /> : <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Detected</span>}
            </button>
          ))}</>)}
        {group(wallets.length ? 'Popular' : mobile ? 'Open SoSwapDEX in your wallet' : 'Popular')}
        {popular.map((p) => {
          const href = mobile && p.mobile && url ? p.mobile(url) : p.install;
          return (
            <a key={p.id} href={href} target="_blank" rel="noreferrer noopener" className={rowCls} aria-label={`${mobile ? 'Open' : 'Install'} ${p.name}`}>
              <WalletGlyph id={p.id} name={p.name} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-zinc-50">{p.name}</span>
              <span className="text-[12px] font-medium text-zinc-500">{mobile && p.mobile ? 'Open' : 'Get'}</span>
            </a>
          );
        })}
        {wcEnabled && (
          <button type="button" onClick={onWC} disabled={!!busy} className={rowCls}>
            <OfficialMark kind="walletconnect" size={40} />
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-zinc-50">WalletConnect</span><span className="block text-[11px] text-zinc-500">QR code or any phone wallet</span></span>
            {busy === 'walletconnect' && <Spinner />}
          </button>
        )}
        {mobile && url && (
          <button type="button" onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => undefined); }}
            className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] text-[12px] font-semibold text-zinc-300">{copied ? 'Link copied' : 'Copy link to open in a wallet browser'}</button>
        )}
        {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
        {mobile && wallets.length === 0 && <p className="mt-3 px-1 text-[11px] leading-relaxed text-zinc-500">Phone browsers cannot reach wallets directly. Tapping a wallet reopens SoSwapDEX inside that wallet's own browser. Press Connect there.</p>}
      </div>
      <aside className={cx('rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5', 'hidden sm:block')}>
        <div className="text-center text-[15px] font-semibold text-zinc-50">What is a wallet?</div>
        <div className="mt-5 space-y-5">
          <div className="flex gap-3.5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-300"><Wallet className="h-6 w-6" /></span>
            <div><div className="text-sm font-semibold text-zinc-100">Your keys, your funds</div><p className="mt-0.5 text-[13px] leading-relaxed text-zinc-400">A wallet holds the keys to your assets. SoSwapDEX never holds them, and you approve every order yourself.</p></div></div>
          <div className="flex gap-3.5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-300"><Plug className="h-6 w-6" /></span>
            <div><div className="text-sm font-semibold text-zinc-100">A new way to log in</div><p className="mt-0.5 text-[13px] leading-relaxed text-zinc-400">No email or password. Connecting shares only your public address. Nothing is sent or approved until you sign.</p></div></div>
        </div>
        <div className="mt-6 text-center">
          <a href="https://ethereum.org/en/wallets/find-wallet/" target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center rounded-full bg-orange-500 px-5 text-sm font-semibold text-black transition hover:bg-orange-400">Get a wallet</a>
          <div className="mt-2"><a href="https://ethereum.org/en/wallets/" target="_blank" rel="noreferrer noopener" className="text-sm font-medium text-orange-300 hover:text-orange-200">Learn more</a></div>
        </div>
      </aside>
    </div>
  );
}

function KeyModal() {
  const S = useS();
  const [mode, setMode] = useState<'create' | 'import'>('create');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pk, setPk] = useState('');
  const close = () => { S.setUi('key', false); setErr(null); setPk(''); };

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === 'create') await S.createKey(); else await S.importKey(name, pk);
      S.toast('ok', 'Trading enabled for this tab.');
      close();
    } catch (e: any) { setErr(userFacingError(e, 'Could not enable trading. Please try again.')); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={S.ui.key} onClose={close} title="Enable trading">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-zinc-400">
          Orders on SoDEX are signed by an <b className="text-zinc-200">API key</b>, so your wallet does not pop up for every trade. The key is generated in this browser, registered with <b className="text-zinc-200">one wallet signature</b>, and its private part never leaves this tab.
        </p>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'create', label: 'Create new key' }, { value: 'import', label: 'Import existing key' }]} />
        {mode === 'create' ? (
          <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-black/30 p-3 text-xs text-zinc-400">
            <Row k="Registers on" v={`${NETS[S.net].label} · account #${S.accountID ?? '–'}`} />
            <Row k="Lifetime" v="24 hours" />
            <Row k="Stored" v="This tab only (sessionStorage)" />
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Key name" hint="as shown on sodex.com/apikeys"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-bot-key-01" className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-orange-500/60" /></Field>
            <Field label="Private key" hint="0x…"><input type="password" autoComplete="off" value={pk} onChange={(e) => setPk(e.target.value)} placeholder="0x…" className="tnum h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-orange-500/60" /></Field>
            <p className="text-[11px] text-zinc-600">Use an API key, never your wallet's private key.</p>
          </div>
        )}
        <Notice tone="warn">
          Treat this as a hot key. SoSwapDEX could not confirm from the public docs that a standard API key is blocked from SoDEX's transfer endpoints, so: fund only what you intend to trade, let it expire, and revoke keys you no longer use at <a className="underline" href={`${SODEX_SITE}/apikeys`} target="_blank" rel="noreferrer">sodex.com/apikeys</a>.
        </Notice>
        {err && <Notice tone="error">{err}</Notice>}
        <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={go} disabled={mode === 'import' && (!name || !pk)}>
          {mode === 'create' ? 'Sign & enable trading' : 'Import key'}
        </Button>
      </div>
    </Modal>
  );
}

function SettingsModal() {
  const S = useS();
  const close = () => S.setUi('settings', false);
  return (
    <Modal open={S.ui.settings} onClose={close} title="Settings">
      <div className="space-y-5">
        <Field label="Network">
          <Segmented value={S.net} onChange={(n) => { S.setNet(n); S.toast('info', `Switched to ${NETS[n].label}.`); }} options={[{ value: 'mainnet', label: 'Mainnet' }, { value: 'testnet', label: 'Testnet' }]} />
        </Field>
        {S.net === 'mainnet' && <Notice tone="warn">Mainnet uses real funds. Test new bots on Testnet first when you can.</Notice>}
        <Field label="Default slippage" hint="max price movement allowed on market orders">
          <div className="flex gap-2">
            {['0.1', '0.5', '1', '2'].map((s) => (
              <button key={s} onClick={() => S.setSlippage(s)} className={cx('h-9 flex-1 rounded-lg text-xs font-semibold transition', S.slippage === s ? 'bg-orange-500 text-black' : 'border border-white/10 text-zinc-300 hover:bg-white/[0.06]')}>{s}%</button>
            ))}
          </div>
        </Field>
        <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={S.deadman} onChange={(e) => S.setDeadman(e.target.checked)} className="mt-1 accent-orange-500" />
            <span>
              <span className="block text-sm font-semibold text-zinc-100">Safety switch</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">While this tab is open it re-arms SoDEX's schedule-cancel every 10 s (now + 60 s). If the tab closes or the connection drops, SoDEX cancels <b className="text-zinc-300">all</b> open orders on the account within about a minute. Limit: 10 triggers per day.</span>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={S.reloadMarkets}><RefreshCw className="h-3.5 w-3.5" />Reload markets</Button>
          {S.key && <Button size="sm" variant="danger" onClick={() => { S.forgetKey(); S.toast('info', 'Key removed from this tab.'); }}>Forget trade key</Button>}
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-600">{DISCLAIMER}</p>
      </div>
    </Modal>
  );
}

function AssetPicker({ open, onClose, onPick, current, only }: { open: boolean; onClose: () => void; onPick: (a: Asset) => void; current?: string; only?: 'risk' }) {
  const S = useS();
  const [q, setQ] = useState('');
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return S.assets
      .filter((a) => !(only === 'risk' && a.isQuote))
      .filter((a) => !qq || a.key.toLowerCase().includes(qq) || a.coin.toLowerCase().includes(qq))
      .map((a) => ({ a, bal: S.available(a.coin), price: a.symbol ? S.tickers[a.symbol.name]?.last ?? 0 : 1 }))
      .sort((x, y) => y.bal * y.price - x.bal * x.price || 0);
  }, [S.assets, S.tickers, S.balances, q, only]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Select a token">
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-orange-500/60">
          <Search className="h-4 w-4 text-zinc-500" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or symbol" className="h-10 w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
        </div>
        <div className="-mx-2 max-h-[55vh] overflow-y-auto">
          {S.marketLoading && !rows.length && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="m-2 h-11" />)}
          {!S.marketLoading && !rows.length && <Empty icon={<Search className="h-5 w-5" />} title="No tokens found" />}
          {rows.map(({ a, bal, price }) => (
            <button key={a.key} disabled={!!a.symbol?.halted} onClick={() => { onPick(a); onClose(); }}
              className={cx('flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.05] disabled:opacity-40', current === a.key && 'bg-orange-500/10')}>
              <TokenIcon name={a.key} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">{a.key}{a.symbol?.halted && <Badge tone="rose">Halted</Badge>}</div>
                <div className="tnum text-xs text-zinc-500">{a.isQuote ? 'USD Coin' : `$${px(price)}`}</div>
              </div>
              <div className="text-right"><div className="tnum text-sm text-zinc-200">{bal ? num(bal, 6) : '–'}</div>{bal > 0 && <div className="tnum text-[11px] text-zinc-500">{usd(bal * price)}</div>}</div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Generic review-and-confirm sheet. `run` may report progress; its returned string is shown on success. */
/** Shown after a confirmed swap. Image is drawn locally; nothing is uploaded. */
function ShareTrade({ data }: { data: ShareData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [note, setNote] = useState('');
  const url = typeof window !== 'undefined' ? window.location.origin + '/' : '';
  const text = `Just swapped ${data.pay} for about ${data.get} on SoDEX with SoSwapDEX. The total cost was shown before I signed. ${url}`;
  useEffect(() => { if (ref.current) drawShareCard(ref.current, data); }, [data]);
  const share = async () => {
    try {
      const blob = ref.current ? await canvasToBlob(ref.current) : null;
      const file = blob ? new File([blob], 'soswap-trade.png', { type: 'image/png' }) : null;
      const nav: any = navigator;
      if (file && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text }); return; }
      if (nav.share) { await nav.share({ text, url }); return; }
      await navigator.clipboard.writeText(text); setNote('Text copied. Paste it anywhere.');
    } catch (e: any) { if (e?.name !== 'AbortError') setNote('Sharing is not available here. Use Download image.'); }
  };
  const download = async () => {
    const blob = ref.current ? await canvasToBlob(ref.current) : null; if (!blob) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'soswap-trade.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  return (
    <div className="ss-fade rounded-2xl border border-white/[0.07] bg-black/30 p-3">
      <canvas ref={ref} width={SHARE_W} height={SHARE_H} role="img" aria-label="Shareable trade card" className="w-full rounded-xl border border-white/10" />
      <p className="mt-2 text-[11px] text-zinc-500">The card has no wallet address or balances. It is drawn on your device and not uploaded.</p>
      <div className="mt-2 flex gap-2"><Button size="sm" variant="primary" className="flex-1" onClick={share}>Share</Button><Button size="sm" className="flex-1" onClick={download}>Download image</Button></div>
      {note && <p className="mt-2 text-[11px] text-orange-300" role="status">{note}</p>}
    </div>
  );
}

function CostReceipt({ pay, get, lines, total, totalPct, notes }: {
  pay: string; get: string; lines: { k: string; v: string; sub?: string }[]; total: string; totalPct: number; notes: string[];
}) {
  return (
    <div className="ss-receipt" role="group" aria-label="Cost breakdown">
      <div className="flex items-baseline justify-between gap-3">
        <div><div className="text-[12px] text-zinc-500">You pay</div><div className="tnum text-lg font-semibold text-zinc-50"><Num v={pay} /></div></div>
        <div className="text-right"><div className="text-[12px] text-zinc-500">You get, about</div><div className="tnum text-lg font-semibold text-zinc-50"><Num v={get} /></div></div>
      </div>
      <div className="ss-rule" />
      <dl className="ss-stagger space-y-1.5 text-[13px]">
        {lines.map((l, i) => (
          <div key={l.k} style={{ '--i': i } as React.CSSProperties} className="flex items-baseline justify-between gap-3">
            <dt className="text-zinc-400">{l.k}{l.sub && <span className="ml-1.5 text-[11px] text-zinc-600">{l.sub}</span>}</dt>
            <dd className="tnum shrink-0 whitespace-nowrap text-right text-zinc-200"><Num v={l.v} /></dd>
          </div>
        ))}
      </dl>
      <div className="ss-rule" />
      <div className="flex items-end justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-100">Total cost of this swap</div>
        <div className="text-right"><div className="ss-total"><Num v={total} /></div><div className="tnum text-[11px] text-zinc-500">{totalPct.toFixed(totalPct < 0.1 ? 3 : 2)}% of the order</div></div>
      </div>
      {notes.length > 0 && <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-zinc-500">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </div>
  );
}

function ReviewModal({ open, onClose, title, rows, warn, confirmLabel, run, receipt, doneExtra, check, ack }: {
  receipt?: React.ReactNode; doneExtra?: React.ReactNode;
  /** Pre-trade check shown first in the review (see lib/risk.ts). `ack` makes the user tick a box before confirming. */
  check?: { grade: Grade; flags: Flag[] }; ack?: string;
  open: boolean; onClose: () => void; title: string; rows: { k: string; v: React.ReactNode; tone?: 'good' | 'bad' | 'warn' }[];
  warn?: string; confirmLabel: string; run: (progress: (s: string) => void) => Promise<string | void>;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [acked, setAcked] = useState(false);
  useEffect(() => { if (open) { setState('idle'); setMsg(''); setAcked(false); } }, [open]);
  const go = async () => {
    if (ack && !acked) return;
    setState('busy'); setMsg('Signing and submitting…');
    try { const r = await run((s) => setMsg(s)); setState('done'); setMsg(r || 'Done'); }
    catch (e: any) { setState('error'); setMsg(e?.message ?? 'Something went wrong'); }
  };
  return (
    <Modal open={open} onClose={() => state !== 'busy' && onClose()} title={title}>
      <div className="space-y-4">
        {check && state === 'idle' && (
          <div role="status" data-testid="pretrade-check" className={cx('rounded-2xl border p-3.5', GRADE[check.grade].cls)}>
            <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4" />Trade check: {GRADE[check.grade].label}</div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12px] leading-snug">
              {check.flags.length ? check.flags.map((f) => <li key={f.text}>{f.text}</li>) : <li>No liquidity, spread or volatility warnings at this size.</li>}
            </ul>
            <p className="mt-1.5 text-[11px] opacity-80">Based on the live order book right now. It is not a prediction or advice.</p>
          </div>
        )}
        {receipt ?? <div className="space-y-2.5 rounded-2xl border border-white/[0.07] bg-black/30 p-4">{rows.map((r) => <Row key={r.k} k={r.k} v={r.v} tone={r.tone} />)}</div>}
        {warn && state === 'idle' && <Notice tone="warn">{warn}</Notice>}
        {ack && state === 'idle' && (
          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] text-zinc-300">
            <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-500" />
            <span>{ack}</span>
          </label>
        )}
        {state === 'busy' && <Notice tone="info"><span className="inline-flex items-center gap-2"><Spinner className="h-3.5 w-3.5" />{msg}</span></Notice>}
        {state === 'done' && <Notice tone="ok">{msg}</Notice>}
        {state === 'done' && doneExtra}
        {state === 'error' && <Notice tone="error">{msg}</Notice>}
        {state === 'done' ? <Button className="w-full" size="lg" onClick={onClose}>Close</Button>
          : <Button variant="primary" size="lg" className="w-full" loading={state === 'busy'} disabled={!!ack && !acked} onClick={go}>{state === 'error' ? 'Try again' : confirmLabel}</Button>}
      </div>
    </Modal>
  );
}

/* ═════════════════════════ swap view: chart, order book, trades, swap + limit panels ═════════════════════════ */

const ceilStep = (x: number, step: string) => stripZeros((Math.ceil(x / Number(step) - 1e-9) * Number(step)).toFixed(decimalsOf(step)));

/** Polls several order books (visible tab only). */
function useBooks(names: string[], ms = 1800, limit = 25) {
  const S = useS();
  const [books, setBooks] = useState<Record<string, { bids: Level[]; asks: Level[] }>>({});
  const [err, setErr] = useState<string | null>(null);
  const dep = names.join('|');
  useEffect(() => {
    if (!names.length) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stop) return;
      if (!document.hidden) {
        try {
          const res = await Promise.all(names.map((n) => fetchBook(S.net, n, limit)));
          if (!stop) { setBooks((b) => { const nb = { ...b }; names.forEach((n, i) => { nb[n] = res[i]; }); return nb; }); setErr(null); }
        } catch (e: any) { if (!stop) setErr(e?.message ?? 'Order book unavailable'); }
      }
      if (!stop) timer = setTimeout(tick, ms);
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep, S.net, ms, limit]);
  return { books, err };
}

/* ───────── candle chart ───────── */

const INTERVALS = ['5m', '15m', '1h', '4h', '1D'] as const;
function PriceChart({ symbol }: { symbol: string }) {
  const S = useS();
  const [interval, setIntervalV] = useState<(typeof INTERVALS)[number]>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true); setCandles([]);
    const load = async () => {
      if (stop) return;
      try { const c = await fetchKlines(S.net, symbol, interval, 120); if (!stop) { setCandles(c); setErr(null); } }
      catch (e: any) { if (!stop) setErr(e?.message ?? 'Chart unavailable'); }
      finally { if (!stop) { setLoading(false); timer = setTimeout(load, 20_000); } }
    };
    load();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [symbol, interval, S.net]);

  const W = 800, H = 280, PAD_R = 64, PAD_B = 18;
  const geo = useMemo(() => {
    if (candles.length < 2) return null;
    const hi = Math.max(...candles.map((c) => c.h)), lo = Math.min(...candles.map((c) => c.l));
    const span = hi - lo || hi * 0.01 || 1;
    const top = hi + span * 0.05, bot = lo - span * 0.05;
    const iw = W - PAD_R, ih = H - PAD_B;
    const y = (p: number) => ih - ((p - bot) / (top - bot)) * ih;
    return { top, bot, iw, ih, y, step: iw / candles.length };
  }, [candles]);
  const cur = hover !== null ? candles[hover] : candles[candles.length - 1];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="tnum flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
          {cur && <><span>O <b className="text-zinc-300">{px(cur.o)}</b></span><span>H <b className="text-zinc-300">{px(cur.h)}</b></span><span>L <b className="text-zinc-300">{px(cur.l)}</b></span><span>C <b className={cur.c >= cur.o ? 'text-emerald-400' : 'text-rose-400'}>{px(cur.c)}</b></span></>}
        </div>
        <Segmented value={interval} onChange={setIntervalV} options={INTERVALS.map((i) => ({ value: i, label: i }))} />
      </div>
      <div className="relative">
        {loading && <div className="absolute inset-0 grid place-items-center"><Spinner className="h-5 w-5 text-zinc-600" /></div>}
        {err && !candles.length && <div className="absolute inset-0 grid place-items-center px-6"><Notice tone="error">{err}</Notice></div>}
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[260px] w-full touch-none select-none sm:h-[300px]" preserveAspectRatio="none" role="img" aria-label="Price chart"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            if (!geo) return;
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * W;
            setHover(clamp(Math.floor(x / geo.step), 0, candles.length - 1));
          }}>
          {geo && [0, 0.25, 0.5, 0.75, 1].map((f) => {
            const p = geo.bot + (geo.top - geo.bot) * f;
            return <g key={f}><line x1={0} x2={geo.iw} y1={geo.y(p)} y2={geo.y(p)} stroke="rgba(255,255,255,0.05)" /><text x={W - 4} y={geo.y(p) + 3} textAnchor="end" fontSize="10" fill="#71717a">{px(p)}</text></g>;
          })}
          {geo && candles.map((c, i) => {
            const up = c.c >= c.o, col = up ? '#10b981' : '#f43f5e';
            const cxp = i * geo.step + geo.step / 2, bw = Math.max(1.5, geo.step * 0.62);
            const y1 = geo.y(Math.max(c.o, c.c)), y2 = geo.y(Math.min(c.o, c.c));
            return (
              <g key={c.t}>
                <line x1={cxp} x2={cxp} y1={geo.y(c.h)} y2={geo.y(c.l)} stroke={col} strokeWidth="1" />
                <rect x={cxp - bw / 2} y={y1} width={bw} height={Math.max(1, y2 - y1)} fill={col} rx="0.5" />
              </g>
            );
          })}
          {geo && hover !== null && <line x1={hover * geo.step + geo.step / 2} x2={hover * geo.step + geo.step / 2} y1={0} y2={geo.ih} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />}
          {geo && candles.length > 0 && (() => {
            const last = candles[candles.length - 1];
            return <line x1={0} x2={geo.iw} y1={geo.y(last.c)} y2={geo.y(last.c)} stroke="#f59e0b" strokeOpacity=".6" strokeDasharray="4 4" />;
          })()}
        </svg>
      </div>
    </div>
  );
}

/* ───────── order book + recent trades ───────── */

function OrderBook({ book, sym, onPick }: { book?: { bids: Level[]; asks: Level[] }; sym?: Sym; onPick?: (price: number) => void }) {
  const rows = 9;
  const asks = (book?.asks ?? []).slice(0, rows);
  const bids = (book?.bids ?? []).slice(0, rows);
  const max = Math.max(1e-12, ...asks.map((l) => l.size), ...bids.map((l) => l.size));
  const spread = asks[0] && bids[0] ? ((asks[0].price - bids[0].price) / asks[0].price) * 100 : null;
  const Line = ({ l, side }: { l: Level; side: 'a' | 'b' }) => (
    <button onClick={() => onPick?.(l.price)} className="group relative grid w-full grid-cols-2 px-2 py-[3px] text-left text-[11px] hover:bg-white/[0.04]">
      <span className={cx('absolute inset-y-0 right-0 transition-all duration-500', side === 'a' ? 'bg-rose-500/12' : 'bg-emerald-500/12')} style={{ width: `${(l.size / max) * 100}%` }} />
      <span className={cx('tnum relative', side === 'a' ? 'text-rose-400' : 'text-emerald-400')}>{px(l.price)}</span>
      <span className="tnum relative text-right text-zinc-300">{num(l.size, sym?.qtyPrec ?? 4)}</span>
    </button>
  );
  return (
    <div>
      <div className="grid grid-cols-2 px-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-600"><span>Price (USDC)</span><span className="text-right">Size</span></div>
      {!book ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="mx-2 my-1 h-3.5" />) : (
        <>
          <div className="flex flex-col-reverse">{asks.map((l, i) => <Line key={'a' + i} l={l} side="a" />)}</div>
          <div className="my-1 flex items-center justify-between border-y border-white/[0.06] px-2 py-1.5 text-[11px]">
            <span className="tnum text-sm font-semibold text-zinc-100">{bids[0] && asks[0] ? px((bids[0].price + asks[0].price) / 2) : '–'}</span>
            <span className="tnum text-zinc-500">spread {spread === null ? '–' : spread.toFixed(3) + '%'}</span>
          </div>
          <div>{bids.map((l, i) => <Line key={'b' + i} l={l} side="b" />)}</div>
        </>
      )}
    </div>
  );
}

function RecentTrades({ symbol }: { symbol: string }) {
  const S = useS();
  const [rows, setRows] = useState<{ price: number; qty: number; side: string; time: number }[] | null>(null);
  useEffect(() => {
    let stop = false; let timer: ReturnType<typeof setTimeout> | undefined;
    setRows(null);
    const tick = async () => {
      if (stop) return;
      if (!document.hidden) { try { const r = await fetchPublicTrades(S.net, symbol, 24); if (!stop) setRows(r); } catch { /* keep last */ } }
      if (!stop) timer = setTimeout(tick, 3500);
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [symbol, S.net]);
  return (
    <div>
      <div className="grid grid-cols-3 px-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-600"><span>Price</span><span className="text-right">Size</span><span className="text-right">Time</span></div>
      {!rows ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="mx-2 my-1 h-3.5" />) : rows.length === 0 ? <div className="px-2 py-6 text-center text-xs text-zinc-600">No recent trades</div> : rows.slice(0, 19).map((t, i) => (
        <div key={i} className="grid grid-cols-3 px-2 py-[3px] text-[11px]">
          <span className={cx('tnum', /sell|2|s/i.test(t.side) && !/buy|1|b/i.test(t.side) ? 'text-rose-400' : 'text-emerald-400')}>{px(t.price)}</span>
          <span className="tnum text-right text-zinc-300">{num(t.qty, 5)}</span>
          <span className="tnum text-right text-zinc-600">{t.time ? new Date(t.time).toLocaleTimeString('en-GB') : ''}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────── trade execution helpers ───────── */

async function waitForFills(net: Net, address: string, aid: number, symbol: string, orderID: number): Promise<Fill[]> {
  for (let i = 0; i < 8; i++) {
    await sleep(i === 0 ? 500 : 800);
    try {
      const f = await fetchFills(net, address, { symbol, orderID, aid, limit: 50 });
      const mine = f.filter((x) => x.orderID === orderID);
      if (mine.length) return mine;
    } catch { /* retry */ }
  }
  return [];
}
const sumFills = (f: Fill[]) => {
  const base = f.reduce((s, x) => s + x.qty, 0);
  const quote = f.reduce((s, x) => s + x.qty * x.price, 0);
  const feeQuote = f.filter((x) => x.feeCoin === QUOTE).reduce((s, x) => s + x.fee, 0);
  const feeBase = f.filter((x) => x.feeCoin !== QUOTE).reduce((s, x) => s + x.fee, 0);
  return { base, quote, feeQuote, feeBase, avg: base > 0 ? quote / base : 0 };
};
const orderError = (r?: OrderResult) => (r && r.code !== 0 ? r.error || `Order rejected (code ${r.code})` : '');

/* ───────── swap panel ───────── */

const TokenBtn = ({ a, onClick }: { a?: Asset; onClick: () => void }) => (
  <button onClick={onClick} className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-1.5 pr-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-500/50 hover:bg-white/[0.08] active:scale-95">
    {a ? <TokenIcon name={a.key} size={28} /> : <Skeleton className="h-7 w-7 rounded-full" />}{a?.key ?? '…'}<ChevronDown className="h-4 w-4 text-zinc-500" />
  </button>
);


function takeSwapIntent() {
  const i = { side: swapIntent.side, usd: swapIntent.usd, focus: !!swapIntent.focus };
  swapIntent.pair = undefined; swapIntent.side = undefined; swapIntent.usd = undefined; swapIntent.focus = undefined;
  return i;
}

function SwapPanel() {
  const S = useS();
  const path = useRef(takeSwapIntent()).current;
  const [fromKey, setFromKey] = useState('USDC');
  const [toKey, setToKey] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [review, setReview] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [pulsePreview, setPulsePreview] = useState(path.focus);

  const fromA = S.assetByKey[fromKey], toA = S.assetByKey[toKey];
  const slip = clamp(parseFloat(S.slippage) || 0.5, 0.01, 20);

  // keep the chart pair in sync when the user changes the pair here, and adopt pairs picked elsewhere
  useEffect(() => {
    const s = S.symByName[S.selected];
    if (!s || !S.assetByKey[s.base]) return;
    if (path.side === 'sell') {
      if (fromKey !== s.base || toKey !== 'USDC') { setFromKey(s.base); setToKey('USDC'); }
    } else if (fromKey !== s.base && toKey !== s.base) {
      setToKey(s.base); setFromKey('USDC');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.selected, S.symByName]);

  useEffect(() => {
    if (!path.usd && !path.focus) return;
    const s = S.symByName[S.selected];
    if (!s) return;
    if (path.usd) {
      const usdN = Number(path.usd);
      if (usdN > 0) {
        if (path.side === 'sell') {
          const last = S.tickers[s.name]?.last;
          if (!last) return;
          setAmount(floorStep(usdN / last, s.step));
        } else {
          setAmount(fixedStr(usdN, 6));
        }
      }
      path.usd = undefined;
    }
    if (path.focus) {
      path.focus = false;
      setPulsePreview(true);
      const t = window.setTimeout(() => setPulsePreview(false), 2600);
      requestAnimationFrame(() => document.getElementById('route-preview')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return () => clearTimeout(t);
    }
  }, [S.selected, S.symByName, S.tickers]);

  const chooseFrom = (a: Asset) => { if (a.key === toKey) setToKey(fromKey); setFromKey(a.key); const r = a.isQuote ? S.assetByKey[a.key === toKey ? fromKey : toKey] : a; if (r?.symbol) S.setSelected(r.symbol.name); };
  const chooseTo = (a: Asset) => { if (a.key === fromKey) setFromKey(toKey); setToKey(a.key); const r = a.isQuote ? S.assetByKey[a.key === fromKey ? toKey : fromKey] : a; if (r?.symbol) S.setSelected(r.symbol.name); };
  const flip = () => { setFromKey(toKey); setToKey(fromKey); setAmount(''); };

  const legNames = [fromA && !fromA.isQuote ? fromA.symbol!.name : null, toA && !toA.isQuote ? toA.symbol!.name : null].filter(Boolean) as string[];
  const { books, err: bookErr } = useBooks(legNames, 1800, 40);

  const amt = parseFloat(amount) || 0;
  const avail = fromA ? S.available(fromA.coin) : 0;
  const fromPrice = fromA ? (fromA.isQuote ? 1 : S.tickers[fromA.symbol!.name]?.last ?? 0) : 0;

  const q = useMemo(() => {
    if (!fromA || !toA || !amt || fromA.key === toA.key) return null;
    let proceeds = amt, impact = 0, notional = amt, feeUsd = 0, short = false, loading = false;
    const route: string[] = [fromA.key];
    let sellAvg = 0, buyAvg = 0;
    if (!fromA.isQuote) {
      const b = books[fromA.symbol!.name];
      if (!b) loading = true; else {
        const r = quoteSell(b.bids, amt);
        notional = r.quote; short = short || r.shortfall; sellAvg = r.avg;
        feeUsd += r.quote * fromA.symbol!.taker;
        proceeds = r.quote * (1 - fromA.symbol!.taker);
        if (b.bids[0]) impact += Math.max(0, ((b.bids[0].price - r.avg) / b.bids[0].price) * 100);
      }
      route.push('USDC');
    }
    let out = proceeds;
    if (!toA.isQuote) {
      const b = books[toA.symbol!.name];
      if (!b) loading = true; else {
        const r = quoteBuy(b.asks, proceeds);
        short = short || r.shortfall; buyAvg = r.avg;
        feeUsd += proceeds * toA.symbol!.taker;
        out = r.base * (1 - toA.symbol!.taker);
        if (b.asks[0]) impact += Math.max(0, ((r.avg - b.asks[0].price) / b.asks[0].price) * 100);
      }
    }
    route.push(toA.key === 'USDC' ? '' : toA.key);
    const legsN = (!fromA.isQuote ? 1 : 0) + (!toA.isQuote ? 1 : 0);
    const minNotionals = [fromA, toA].filter((a) => !a.isQuote).map((a) => Number(a.symbol!.minNotional));
    const legNotional = !fromA.isQuote ? notional : amt; // value traded on the first leg, in USDC
    const belowMin = minNotionals.length > 0 && legNotional < Math.max(...minNotionals);
    return { out, impact, feeUsd, short, loading, notional, route: route.filter(Boolean), legsN, belowMin, minNotional: Math.max(0, ...minNotionals), sellAvg, buyAvg };
  }, [books, fromA, toA, amt]);

  const symSell = fromA && !fromA.isQuote ? fromA.symbol! : null;
  const symBuy = toA && !toA.isQuote ? toA.symbol! : null;
  const halted = !!(symSell?.halted || symBuy?.halted);
  const minOut = q ? q.out * (1 - slip / 100) : 0;
  const tooMuchImpact = !!q && q.impact > slip;

  /* Safety scan on the same live books the quote uses (see lib/risk.ts). Worst leg wins. */
  const safety = useMemo(() => {
    if (!q || q.loading || !fromA || !toA) return null;
    const legs: { sym: Sym; side: 'buy' | 'sell'; usd: number }[] = [];
    if (!fromA.isQuote) legs.push({ sym: fromA.symbol!, side: 'sell', usd: q.notional });
    if (!toA.isQuote) legs.push({ sym: toA.symbol!, side: 'buy', usd: fromA.isQuote ? amt : q.notional * (1 - fromA.symbol!.taker) });
    const order: Grade[] = ['safe', 'caution', 'avoid'];
    let grade: Grade = 'safe'; const flags: Flag[] = [];
    for (const l of legs) {
      const b = books[l.sym.name], t = S.tickers[l.sym.name];
      if (!b || !t) return null;
      const r = scanTrade({ side: l.side, usd: l.usd, bids: b.bids, asks: b.asks, open: t.open, high: t.high, low: t.low, last: t.last, quoteVol: t.quoteVol, takerFee: l.sym.taker, halted: l.sym.halted });
      if (order.indexOf(r.grade) > order.indexOf(grade)) grade = r.grade;
      for (const f of r.flags) if (f.sev !== 'info' && !flags.some((x) => x.text === f.text)) flags.push({ ...f, text: legs.length > 1 ? `${l.sym.display}: ${f.text}` : f.text });
    }
    return { grade, flags };
  }, [q, books, fromA, toA, amt, S.tickers]);

  const builderBp = S.builder.active ? Math.min(S.builder.fee, S.builder.approvedFee ?? 0) : 0;
  const receipt = q && !q.loading ? (() => {
    const impactUsd = (q.notional * q.impact) / 100;
    const appFee = (q.notional * builderBp * q.legsN) / 100000;
    const totalUsd = impactUsd + q.feeUsd + appFee;
    const notes = [`Price cap set at ${slip}% slippage, so the order will not fill worse than that.`];
    if (q.legsN > 1) notes.push('Two market orders via USDC: both legs are included above.');
    return { impactUsd, appFee, totalUsd, pct: q.notional > 0 ? (totalUsd / q.notional) * 100 : 0, notes };
  })() : null;

  let cta = 'Review swap', ctaDisabled = false, ctaAction: () => void = () => setReview(true);
  if (!S.wallet) { cta = 'Connect wallet'; ctaAction = () => S.setUi('connect', true); }
  else if (S.accountID === null) { cta = 'Deposit on SoDEX first'; ctaAction = () => window.open(SODEX_SITE, '_blank'); }
  else if (S.accountID === undefined) { cta = 'Loading account…'; ctaDisabled = true; }
  else if (!S.keyValid) { cta = 'Enable trading'; ctaAction = () => S.setUi('key', true); }
  else if (halted) { cta = 'Market halted'; ctaDisabled = true; }
  else if (!amt) { cta = 'Enter an amount'; ctaDisabled = true; }
  else if (amt > avail + 1e-12) { cta = `Insufficient ${fromKey}`; ctaDisabled = true; }
  else if (q?.loading) { cta = 'Fetching quote…'; ctaDisabled = true; }
  else if (q?.short) { cta = 'Not enough liquidity'; ctaDisabled = true; }
  else if (q?.belowMin) { cta = `Minimum order ≈ $${q.minNotional}`; ctaDisabled = true; }
  else if (tooMuchImpact) { cta = 'Price impact above slippage'; ctaDisabled = true; }

  const [exec, setExec] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  useEffect(() => { setExec((e) => (e === 'pending' ? e : 'idle')); }, [amount, fromKey, toKey]);
  const runSwap = async (progress: (s: string) => void): Promise<string> => {
    if (!S.wallet || !S.key || !fromA || !toA) throw new Error('Not ready');
    const addr = S.wallet.address, aid = S.key.accountID;
    let funds = amt; let summary = '';
    const sellBook = symSell ? books[symSell.name] : undefined, buyBook = symBuy ? books[symBuy.name] : undefined;
    // leg 1: sell the source token for USDC
    if (symSell) {
      const best = sellBook?.bids[0]?.price; if (!best) throw new Error('No bids available right now.');
      const qty = floorStep(amt, symSell.step);
      if (Number(qty) < Number(symSell.marketMinQty)) throw new Error(`Minimum quantity is ${symSell.marketMinQty} ${symSell.base}.`);
      const protect = floorStep(best * (1 - slip / 100), symSell.tick);
      progress(`Selling ${qty} ${symSell.base}…`);
      const [res] = await S.place([{ symbolID: symSell.id, clOrdID: uid('sw'), side: 2, type: OTYPE.MARKET, tif: TIF.IOC, price: protect, quantity: qty }]);
      const e1 = orderError(res); if (e1) throw new Error(e1);
      progress('Waiting for the fill…');
      const fills = res.orderID ? await waitForFills(S.net, addr, aid, symSell.name, res.orderID) : [];
      const f = sumFills(fills);
      if (!fills.length) throw new Error('Order accepted but no fill was reported (it may have been cancelled by the price limit). Check Portfolio.');
      funds = Math.max(0, f.quote - f.feeQuote);
      summary = `Sold ${num(f.base, 8)} ${symSell.base} @ ${px(f.avg)}`;
      if (symBuy) funds *= 0.999; // keep a small buffer for rounding
    }
    // leg 2: buy the target token with USDC
    if (symBuy) {
      const best = buyBook?.asks[0]?.price; if (!best) throw new Error('No asks available right now.');
      const fundsStr = fixedStr(funds, 6);
      if (Number(fundsStr) < Number(symBuy.minNotional)) throw new Error(`Amount is below the ${symBuy.minNotional} USDC minimum.`);
      const protect = ceilStep(best * (1 + slip / 100), symBuy.tick);
      progress(`Buying ${symBuy.base} with ${fundsStr} USDC…`);
      const [res] = await S.place([{ symbolID: symBuy.id, clOrdID: uid('sw'), side: 1, type: OTYPE.MARKET, tif: TIF.IOC, price: protect, funds: fundsStr }]);
      const e2 = orderError(res);
      if (e2) throw new Error(symSell ? `${summary}. Second leg failed: ${e2}. Your USDC from the first leg is in your balance.` : e2);
      progress('Waiting for the fill…');
      const fills = res.orderID ? await waitForFills(S.net, addr, aid, symBuy.name, res.orderID) : [];
      const f = sumFills(fills);
      summary += `${summary ? ' → ' : ''}Bought ${fills.length ? num(f.base - f.feeBase, 8) : '?'} ${symBuy.base}${fills.length ? ` @ ${px(f.avg)}` : ' (fill pending)'}`;
    } else {
      summary += ` for ${usd(funds, 2)} USDC`;
    }
    S.refreshAccount();
    setAmount('');
    return summary;
  };

  /** Success is only shown once SoDEX reports the fill; an accepted order without a fill stays unconfirmed. */
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const runTracked = async (progress: (s: string) => void): Promise<string> => {
    setExec('pending');
    try { const snap = q && receipt ? { pay: `${amount} ${fromKey}`, get: `${num(q.out, 6)} ${toKey}`, costPct: receipt.pct, netLabel: NETS[S.net].label } : null; const r = await runSwap(progress); const ok = !/fill pending/.test(r); if (ok) { lsSet('soswap.swapped', true); if (snap) setShareData(snap); } setExec(ok ? 'success' : 'idle'); return r; }
    catch (e) { setExec('error'); throw e; }
  };
  const swapStatus = exec !== 'idle' ? exec : q && !q.loading && q.out && !q.short && !q.belowMin ? 'preview' : 'idle';

  const routeRows = q && !q.loading ? [
    { k: 'Best Route', v: q.route.join(' → ') },
    { k: 'Est. Receive', v: `≈ ${num(q.out, 6)} ${toKey}` },
    { k: 'Price', v: q.out && amt ? `1 ${fromKey} ≈ ${num(q.out / amt, 6)} ${toKey}` : '–' },
    { k: 'Route', v: `SoDEX (${NETS[S.net].label})` },
  ] : null;

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-2 rounded-2xl border border-orange-500/20 bg-black/40 p-3 shadow-[inset_0_0_40px_-20px_rgba(249,115,22,0.35)]">
          <div className="rounded-xl border border-white/[0.07] bg-black/40 p-3.5 transition focus-within:border-orange-500/50">
            <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold text-zinc-200">From</span>
              <button onClick={() => fromA && setAmount(fromA.isQuote ? fixedStr(avail, 6) : floorStep(avail, fromA.symbol!.step))} className="tnum text-zinc-400 hover:text-orange-400">Balance: {num(avail, 6)}</button></div>
            <div className="flex items-center gap-3">
              <TokenBtn a={fromA} onClick={() => setPicker('from')} />
              <input aria-label="Amount to pay" inputMode="decimal" autoComplete="off" value={amount} placeholder="0" onChange={(e) => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) setAmount(v); }}
                className="tnum min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold text-zinc-50 outline-none placeholder:text-zinc-600" />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="tnum text-[11px] text-zinc-500">{amt && fromPrice ? `≈ ${usd(amt * fromPrice)}` : ' '}</span>
              <div className="flex gap-1">{[0.25, 0.5, 1].map((f) => (
                <button key={f} onClick={() => fromA && setAmount(fromA.isQuote ? fixedStr(avail * f, 6) : floorStep(avail * f, fromA.symbol!.step))} disabled={!avail}
                  className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:border-orange-500 hover:text-orange-400 disabled:opacity-40">{f === 1 ? 'MAX' : `${f * 100}%`}</button>))}</div>
            </div>
          </div>
          <div className="relative z-10 -my-4 flex justify-center">
            <button onClick={flip} aria-label="Swap direction" className="grid h-9 w-9 place-items-center rounded-full border-2 border-orange-500/30 bg-[#120c07] text-orange-300 transition hover:bg-orange-500 hover:text-black active:scale-90"><ArrowDownUp className="h-4 w-4" /></button>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-black/40 p-3.5">
            <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold text-zinc-200">To</span><span className="tnum text-zinc-400">Balance: {num(toA ? S.available(toA.coin) : 0, 6)}</span></div>
            <div className="flex items-center gap-3">
              <TokenBtn a={toA} onClick={() => setPicker('to')} />
              <div className={cx('tnum min-w-0 flex-1 truncate text-right text-2xl font-semibold', q && !q.loading && q.out ? 'text-zinc-50' : 'text-zinc-600')}>{q?.loading ? <Skeleton className="ml-auto h-7 w-28" /> : q && q.out ? <Num v={'≈ ' + num(q.out, 6)} /> : '0'}</div>
            </div>
            <div className="tnum mt-1.5 text-[11px] text-zinc-500">{q && !q.loading && q.out && toA ? `≈ ${usd(q.out * (toA.isQuote ? 1 : S.tickers[toA.symbol!.name]?.last ?? 0))}` : ' '}</div>
          </div>
        </div>

        <div id="route-preview" className={cx('rounded-2xl border border-orange-500/20 bg-black/40 p-4 transition', pulsePreview && 'ring-2 ring-orange-400/80 shadow-[0_0_40px_-10px_rgba(249,115,22,0.75)]')}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Star className="h-4 w-4 fill-orange-400 text-orange-400" />Route Preview (SoDEX)</h3>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">{S.marketErr ? 'Offline' : 'Live'}</span>
          </div>
          {routeRows ? (
            <div className="ss-stagger space-y-2.5">
              {routeRows.map((r, i) => <div key={r.k} style={{ '--i': i } as React.CSSProperties} className="flex items-center justify-between gap-3 text-[13px]"><span className="text-zinc-400">{r.k}</span><span className="tnum text-right font-medium text-zinc-100"><Num v={r.v} /></span></div>)}
              <div style={{ '--i': 4 } as React.CSSProperties} className="my-1 border-t border-white/[0.06]" />
              <div style={{ '--i': 5 } as React.CSSProperties}><Row k="Price impact" v={<Num v={`${q!.impact < 0.01 ? '<0.01' : q!.impact.toFixed(2)}%`} />} tone={q!.impact > slip ? 'bad' : q!.impact > slip / 2 ? 'warn' : 'good'} /></div>
              <div style={{ '--i': 6 } as React.CSSProperties}><Row k={`Min received (${slip}%)`} v={<Num v={`${num(minOut, 6)} ${toKey}`} />} /></div>
              <div style={{ '--i': 7 } as React.CSSProperties}><Row k="Fee (taker, est.)" v={<Num v={usd(q!.feeUsd, 4)} />} /></div>
            </div>
          ) : (
            <div className="space-y-2.5 text-[13px]">
              {['Best Route', 'Est. Receive', 'Price', 'Route'].map((k) => <div key={k} className="flex items-center justify-between"><span className="text-zinc-400">{k}</span><span className="text-zinc-600">{q?.loading ? '…' : '–'}</span></div>)}
              <p className="pt-1 text-[11px] text-zinc-500">Enter an amount to see the live route from the SoDEX order book.</p>
            </div>
          )}
          <button onClick={() => setSlipOpen((o) => !o)} className="mt-3 flex items-center gap-1 rounded-lg px-1 py-1 text-[11px] text-zinc-400 transition hover:text-orange-300"><Settings className="h-3.5 w-3.5" />Slippage {slip}%</button>
          {slipOpen && (
            <div className="ss-fade mt-1 flex gap-1.5">
              {['0.1', '0.5', '1', '2'].map((x) => <button key={x} onClick={() => S.setSlippage(x)} className={cx('h-7 flex-1 rounded-lg text-[11px] font-semibold', S.slippage === x ? 'bg-orange-500 text-black' : 'border border-white/10 text-zinc-300 hover:bg-white/[0.06]')}>{x}%</button>)}
            </div>
          )}
        </div>
      </div>

      {bookErr && <div className="mt-3"><Notice tone="error">{bookErr}</Notice></div>}
      {halted && <div className="mt-3"><Notice tone="warn">Trading is halted on {symSell?.halted ? symSell.display : symBuy?.display}.</Notice></div>}

      {safety && (
        <button onClick={() => S.setView('skills')} aria-label="Open the Skills tab for trade check details"
          className={cx('mt-3 flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition hover:brightness-110', GRADE[safety.grade].cls)}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 text-[12px] leading-snug"><b>{GRADE[safety.grade].label}.</b> {safety.flags.length ? safety.flags[0].text : 'No liquidity, spread or volatility warnings at this size.'}{safety.flags.length > 1 && <span className="opacity-80"> +{safety.flags.length - 1} more</span>}</span>
        </button>
      )}

      <Button variant="primary" size="lg" className="mt-4 w-full !h-12 !rounded-lg" disabled={ctaDisabled} onClick={ctaAction}>
        {!S.wallet && <Wallet className="h-4 w-4" />}{!S.wallet ? 'Connect Wallet to Swap' : cta === 'Review swap' ? 'Swap on SoDEX' : cta}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500"><ShieldCheck className="h-3.5 w-3.5 text-orange-400" />You sign in your wallet. We never ask for a seed phrase.</p>
      <SwapFeedback status={swapStatus} />

      <ReviewModal open={review} onClose={() => setReview(false)} title="Review swap" confirmLabel="Confirm swap" run={runTracked} doneExtra={shareData ? <ShareTrade data={shareData} /> : undefined}
        check={safety ?? undefined} ack={safety?.grade === 'avoid' ? 'I understand this trade is flagged high risk and I want to continue.' : undefined}
        warn={q && q.legsN > 1 ? 'This swap uses two market orders via USDC. If the second one fails, you keep the USDC from the first.' : undefined}
        receipt={q && receipt ? <CostReceipt pay={`${amount} ${fromKey}`} get={`${num(q.out, 8)} ${toKey}`} total={usd(receipt.totalUsd, 3)} totalPct={receipt.pct} notes={receipt.notes}
          lines={[
            { k: 'Price impact', sub: 'vs best price', v: usd(receipt.impactUsd, 3) },
            { k: 'SoDEX trading fee', v: usd(q.feeUsd, 3) },
            ...(builderBp ? [{ k: 'SoSwapDEX fee', sub: bpText(builderBp), v: usd(receipt.appFee, 3) }] : []),
            { k: 'Lowest you should get', sub: `at ${slip}% slippage`, v: `${num(minOut, 8)} ${toKey}` },
            { k: 'Route', v: q.route.join(' → ') },
            { k: 'Network', v: NETS[S.net].label },
          ]} /> : undefined}
        rows={q ? [
          { k: 'You pay', v: `${amount} ${fromKey}` }, { k: 'You receive (est.)', v: `${num(q.out, 8)} ${toKey}` },
          { k: 'Minimum received', v: `${num(minOut, 8)} ${toKey}` }, { k: 'Route', v: q.route.join(' → ') },
          { k: 'Price impact', v: `${q.impact.toFixed(2)}%`, tone: q.impact > slip / 2 ? 'warn' : 'good' }, { k: 'Fee (est.)', v: usd(q.feeUsd, 4) },
          ...(S.builder.active ? [{ k: 'SoSwapDEX fee (max)', v: `${bpText(Math.min(S.builder.fee, S.builder.approvedFee ?? 0))} of each fill` }] : []),
          { k: 'Network', v: NETS[S.net].label, tone: S.net === 'mainnet' ? 'warn' : undefined },
        ] : []} />
      <AssetPicker open={picker === 'from'} onClose={() => setPicker(null)} onPick={chooseFrom} current={fromKey} />
      <AssetPicker open={picker === 'to'} onClose={() => setPicker(null)} onPick={chooseTo} current={toKey} />
    </div>
  );
}

/* ───────── limit panel ───────── */

function LimitPanel({ sym, book, pickedPrice }: { sym?: Sym; book?: { bids: Level[]; asks: Level[] }; pickedPrice: number | null }) {
  const S = useS();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [post, setPost] = useState(false);
  const [review, setReview] = useState(false);
  useEffect(() => { if (pickedPrice) setPrice(roundTick(pickedPrice, sym?.tick ?? '0.01')); }, [pickedPrice]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPrice(''); setQty(''); }, [sym?.name]);

  const p = parseFloat(price) || 0, qn = parseFloat(qty) || 0;
  const total = p * qn;
  const availQuote = S.available(QUOTE), availBase = sym ? S.available(sym.baseCoin) : 0;
  const best = side === 'buy' ? book?.bids[0]?.price : book?.asks[0]?.price;

  let cta = `Place limit ${side}`, dis = false, act: () => void = () => setReview(true);
  if (!S.wallet) { cta = 'Connect wallet'; act = () => S.setUi('connect', true); }
  else if (S.accountID === null) { cta = 'Deposit on SoDEX first'; act = () => window.open(SODEX_SITE, '_blank'); }
  else if (!S.keyValid) { cta = 'Enable trading'; act = () => S.setUi('key', true); }
  else if (!sym) { cta = 'Select a pair'; dis = true; }
  else if (sym.halted) { cta = 'Market halted'; dis = true; }
  else if (!p || !qn) { cta = 'Enter price and size'; dis = true; }
  else if (total < Number(sym.minNotional)) { cta = `Minimum order $${sym.minNotional}`; dis = true; }
  else if (side === 'buy' && total > availQuote + 1e-9) { cta = 'Insufficient USDC'; dis = true; }
  else if (side === 'sell' && qn > availBase + 1e-12) { cta = `Insufficient ${sym.base}`; dis = true; }

  const run = async (progress: (s: string) => void) => {
    if (!sym) throw new Error('No pair');
    const priceStr = roundTick(p, sym.tick), qtyStr = floorStep(qn, sym.step);
    progress('Signing and placing order…');
    const [res] = await S.place([{ symbolID: sym.id, clOrdID: uid('lm'), side: side === 'buy' ? 1 : 2, type: OTYPE.LIMIT, tif: post ? TIF.GTX : TIF.GTC, price: priceStr, quantity: qtyStr }]);
    const e = orderError(res); if (e) throw new Error(e);
    S.refreshAccount(); setQty('');
    return `Limit ${side} ${qtyStr} ${sym.base} @ ${priceStr} placed${res.orderID ? ` (order #${res.orderID})` : ''}.`;
  };

  return (
    <div className="space-y-3">
      <Segmented value={side} onChange={setSide} className="w-full [&>button]:flex-1" options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
      <Field label="Price (USDC)" hint={best ? <button className="hover:text-orange-400" onClick={() => setPrice(roundTick(best, sym?.tick ?? '0.01'))}>Best {side === 'buy' ? 'bid' : 'ask'} {px(best)}</button> : undefined}>
        <AmountInput value={price} onChange={setPrice} suffix="USDC" label="Limit price" />
      </Field>
      <Field label={`Size (${sym?.base ?? ''})`} hint={<button className="hover:text-orange-400" onClick={() => sym && setQty(side === 'sell' ? floorStep(availBase, sym.step) : p ? floorStep(availQuote / p, sym.step) : '')}>Max</button>}>
        <AmountInput value={qty} onChange={setQty} suffix={sym?.base} label="Limit size" />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} className="accent-orange-500" />Post-only (maker only, rejected if it would take liquidity)</label>
      <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-3">
        <Row k="Total" v={total ? usd(total) : '–'} />
        <Row k="Maker fee" v={sym ? `${(sym.maker * 100).toFixed(3)}%` : '–'} />
        <Row k="Tick / step" v={sym ? `${sym.tick} / ${sym.step}` : '–'} />
      </div>
      <Button variant="primary" size="lg" className="w-full" disabled={dis} onClick={act}>{cta}</Button>
      <ReviewModal open={review} onClose={() => setReview(false)} title={`Review limit ${side}`} confirmLabel="Place order" run={run}
        rows={[{ k: 'Pair', v: sym?.display ?? '' }, { k: 'Side', v: side.toUpperCase(), tone: side === 'buy' ? 'good' : 'bad' }, { k: 'Price', v: `${price} USDC` }, { k: 'Size', v: `${qty} ${sym?.base ?? ''}` }, { k: 'Total', v: usd(total) }, { k: 'Type', v: post ? 'Post-only (GTX)' : 'Good till cancelled (GTC)' }, ...(S.builder.active ? [{ k: 'SoSwapDEX fee (max)', v: `${bpText(Math.min(S.builder.fee, S.builder.approvedFee ?? 0))} of each fill` }] : []), { k: 'Network', v: NETS[S.net].label, tone: S.net === 'mainnet' ? 'warn' : undefined }]} />
    </div>
  );
}

/* ───────── pair header + view ───────── */

function PairHeader({ sym }: { sym?: Sym }) {
  const S = useS();
  const [open, setOpen] = useState(false);
  const t = sym ? S.tickers[sym.name] : undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <button onClick={() => setOpen(true)} className="flex items-center gap-2.5 rounded-xl p-1 pr-3 text-left transition hover:bg-white/[0.05]">
        {sym ? <TokenIcon name={sym.base} size={38} /> : <Skeleton className="h-9 w-9 rounded-full" />}
        <div><div className="flex items-center gap-1.5 text-lg font-bold leading-tight text-zinc-50">{sym?.display ?? '…'}<ChevronDown className="h-4 w-4 text-zinc-500" /></div><div className="text-[11px] text-zinc-500">SoDEX spot{sym?.halted ? ' · halted' : ''}</div></div>
      </button>
      <div><div className="tnum text-2xl font-bold text-zinc-50">{t ? <Flash v={t.last}>{'$' + px(t.last)}</Flash> : <Skeleton className="h-7 w-28" />}</div>{t && <Chg pct={t.changePct} />}</div>
      <div className="tnum ml-auto hidden gap-6 text-xs sm:flex">
        <div><div className="text-zinc-600">24h high</div><div className="text-zinc-200">{t ? px(t.high) : '–'}</div></div>
        <div><div className="text-zinc-600">24h low</div><div className="text-zinc-200">{t ? px(t.low) : '–'}</div></div>
        <div><div className="text-zinc-600">24h volume</div><div className="text-zinc-200">{t ? '$' + compact(t.quoteVol) : '–'}</div></div>
      </div>
      <AssetPicker open={open} only="risk" onClose={() => setOpen(false)} onPick={(a) => a.symbol && S.setSelected(a.symbol.name)} current={sym?.base} />
    </div>
  );
}

function SwapView() {
  const S = useS();
  const sym = S.symByName[S.selected] ?? S.syms[0];
  const [adv, setAdv] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => { if (!S.symByName[S.selected] && S.syms.length) S.setSelected(S.symByName['vBTC_vUSDC'] ? 'vBTC_vUSDC' : S.syms[0].name); }, [S.syms]); // eslint-disable-line react-hooks/exhaustive-deps
  const { books } = useBooks(adv && sym ? [sym.name] : [], 1500, 20);
  const book = sym ? books[sym.name] : undefined;

  return (
    <div className="mx-auto max-w-[920px]">
      <PageTitle icon={<ArrowDownUp className="h-7 w-7" />} title="Swap" sub="Trade tokens on SoDEX mainnet with your own wallet." />
      <Card glow className="p-3 sm:p-4"><SwapPanel /></Card>
      <div className="mt-4"><Onboarding /></div>
      <button onClick={() => setAdv((a) => !a)} className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-orange-500/50 hover:text-orange-300">
        <LineChart className="h-3.5 w-3.5" />{adv ? 'Hide' : 'Show'} advanced: chart, order book & limit orders<ChevronDown className={cx('h-3.5 w-3.5 transition', adv && 'rotate-180')} />
      </button>
      {adv && (
        <div className="ss-fade mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Card className="p-4"><PairHeader sym={sym} /></Card>
            <Card className="p-4">{sym ? <PriceChart symbol={sym.name} /> : <Skeleton className="h-[300px]" />}</Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHead title="Order book" icon={<Layers className="h-4 w-4 text-orange-400" />} right={<Badge tone="emerald">Live</Badge>} /><div className="p-2"><OrderBook book={book} sym={sym} onPick={(p) => setPicked(p)} /></div></Card>
              <Card><CardHead title="Recent trades" icon={<History className="h-4 w-4 text-orange-400" />} /><div className="p-2">{sym && <RecentTrades symbol={sym.name} />}</div></Card>
            </div>
          </div>
          <Card><CardHead title="Limit order" icon={<Timer className="h-4 w-4 text-orange-400" />} /><div className="p-4"><LimitPanel sym={sym} book={book} pickedPrice={picked} /></div></Card>
        </div>
      )}
    </div>
  );
}

function Onboarding() {
  const S = useS();
  const [swapped, setSwapped] = useState(false);
  useEffect(() => { setSwapped(lsGet<boolean>('soswap.swapped', false)); }, [S.view]);
  const steps = [
    { done: !!S.wallet, label: 'Connect your wallet', sub: 'Shares your address only', act: () => S.setUi('connect', true) },
    { done: !!S.accountID, label: 'Fund your SoDEX account', sub: 'Deposit on sodex.com (BTC, ETH, SOL, USDC…)', act: () => window.open(SODEX_SITE, '_blank') },
    { done: S.keyValid, label: 'Enable trading', sub: 'One signature, key stays in this tab', act: () => S.setUi('key', true) },
    ...(S.builder.enabled ? [{ done: S.builder.active, label: 'Approve the SoSwapDEX fee', sub: `One signature, max ${bpText(S.builder.fee)} per fill. Optional, revocable`, act: () => { if (!S.accountID) { S.toast('err', 'Fund your SoDEX account first.'); return; } S.builder.approve().then(() => S.toast('ok', 'SoSwapDEX fee approved.')).catch((e: any) => S.toast('err', userFacingError(e, 'Could not approve.'))); } }] : []),
    { done: swapped, label: 'Make your first swap', sub: 'Pick a pair, preview the route, sign in your wallet', act: () => S.setView('swap') },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-semibold text-zinc-100">Get started</div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i}>
            <button onClick={s.act} disabled={s.done} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-left transition hover:bg-white/[0.04] disabled:opacity-60">
              <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold', s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.08] text-zinc-300')}>{s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className="min-w-0"><span className="block text-sm font-medium text-zinc-100">{s.label}</span><span className="block text-[11px] text-zinc-500">{s.sub}</span></span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ═════════════════════════ markets + portfolio ═════════════════════════ */

const coinLabel = (c: string) => (/^v[A-Z]/.test(c) ? c.slice(1) : c);
const ErrorBox = ({ msg, onRetry }: { msg: string; onRetry?: () => void }) => (
  <Notice tone="error" action={onRetry ? <Button size="sm" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Retry</Button> : undefined}>{msg}</Notice>
);

function MarketsView() {
  const S = useS();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'fav' | 'up' | 'down'>('all');
  const [sort, setSort] = useState<{ k: 'pair' | 'price' | 'chg' | 'vol'; dir: 1 | -1 }>({ k: 'vol', dir: -1 });

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let r = S.syms.map((s) => ({ s, t: S.tickers[s.name] })).filter((x) => !qq || x.s.display.toLowerCase().includes(qq) || x.s.name.toLowerCase().includes(qq));
    if (tab === 'fav') r = r.filter((x) => S.favs.includes(x.s.name));
    if (tab === 'up') r = r.filter((x) => (x.t?.changePct ?? 0) > 0);
    if (tab === 'down') r = r.filter((x) => (x.t?.changePct ?? 0) < 0);
    const val = (x: (typeof r)[number]) => (sort.k === 'pair' ? x.s.display : sort.k === 'price' ? x.t?.last ?? 0 : sort.k === 'chg' ? x.t?.changePct ?? 0 : x.t?.quoteVol ?? 0);
    return r.sort((a, b) => { const A = val(a), B = val(b); return (typeof A === 'string' ? (A as string).localeCompare(B as string) : (A as number) - (B as number)) * sort.dir; });
  }, [S.syms, S.tickers, S.favs, q, tab, sort]);

  const H = ({ k, children, right }: { k: typeof sort.k; children: React.ReactNode; right?: boolean }) => (
    <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))} className={cx('flex w-full items-center gap-1 hover:text-zinc-200', right && 'justify-end')}>
      {children}{sort.k === k && <span className="text-orange-400">{sort.dir === 1 ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] p-4">
        <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-orange-500/60">
          <Search className="h-4 w-4 text-zinc-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pairs" aria-label="Search pairs" className="h-full w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: `All ${S.syms.length || ''}` }, { value: 'fav', label: 'Favorites' }, { value: 'up', label: 'Gainers' }, { value: 'down', label: 'Losers' }]} />
      </div>
      {S.marketErr && <div className="p-4"><ErrorBox msg={S.marketErr} onRetry={S.reloadMarkets} /></div>}
      <div className="hidden grid-cols-[minmax(170px,1.5fr)_1fr_.8fr_1fr_212px] gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600 sm:grid">
        <H k="pair">Pair</H><H k="price" right>Price</H><H k="chg" right>24h</H>
        <H k="vol" right>Volume (24h)</H><span />
      </div>
      <div className="flex items-center justify-between px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600 sm:hidden">
        <H k="pair">Pair</H>
        <div className="flex items-center gap-6"><H k="price" right>Price</H><H k="chg" right>24h</H></div>
      </div>
      <div>
        {S.marketLoading && !S.syms.length && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="mx-4 my-2 h-10" />)}
        {!S.marketLoading && !rows.length && !S.marketErr && <Empty icon={<Search className="h-5 w-5" />} title={tab === 'fav' ? 'No favorites yet' : 'No pairs match'} body={tab === 'fav' ? 'Tap the star next to a pair to pin it here.' : undefined} />}
        {rows.map(({ s, t }, i) => (
          <div key={s.name} className="ss-row cursor-pointer border-t border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.04] sm:grid sm:grid-cols-[minmax(170px,1.5fr)_1fr_.8fr_1fr_212px] sm:items-center sm:gap-2"
            onClick={() => { S.setSelected(s.name); S.setView('swap'); }}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="tnum hidden w-4 text-[11px] text-zinc-600 sm:block">{i + 1}</span>
              <button aria-label={S.favs.includes(s.name) ? 'Remove favorite' : 'Add favorite'} onClick={(e) => { e.stopPropagation(); S.toggleFav(s.name); }} className="text-zinc-600 transition hover:text-orange-400">
                <Star className={cx('h-4 w-4', S.favs.includes(s.name) && 'fill-orange-400 text-orange-400')} />
              </button>
              <span className="ss-row-ico"><TokenIcon name={s.base} size={28} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-100">{s.display}</div>
                {s.halted && <Badge tone="rose">Halted</Badge>}
              </div>
              {!s.halted && (
                <button type="button" onClick={(e) => { e.stopPropagation(); goToTradeCheck(S, s.name); }}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-orange-300 hover:text-orange-200 sm:hidden">
                  <ShieldCheck className="h-3 w-3" />Check this trade
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center justify-end gap-4 sm:mt-0 sm:contents">
              <div className="tnum text-right text-sm text-zinc-100">{t ? <Flash v={t.last}>{px(t.last)}</Flash> : <Skeleton className="ml-auto h-4 w-16" />}</div>
              <div className="text-right">{t ? <Chg pct={t.changePct} /> : <Skeleton className="ml-auto h-4 w-12" />}</div>
              <div className="tnum hidden text-right text-sm text-zinc-300 sm:block">{t ? '$' + compact(t.quoteVol) : '–'}</div>
              <div className="hidden items-center justify-end gap-2 sm:flex">
                {!s.halted && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); goToTradeCheck(S, s.name); }}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-orange-300 hover:text-orange-200">
                    <ShieldCheck className="h-3 w-3" />Check this trade
                  </button>
                )}
                <Button size="sm" variant="secondary" disabled={s.halted}>Trade</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PortfolioView() {
  const S = useS();
  const [tab, setTab] = useState<'bal' | 'open' | 'fills' | 'hist'>('bal');
  const [hideSmall, setHideSmall] = useState(true);
  const [hist, setHist] = useState<{ fills: Fill[] | null; orders: OpenOrder[] | null; err: string | null; loading: boolean }>({ fills: null, orders: null, err: null, loading: false });
  const [confirmAll, setConfirmAll] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const spotRows = useMemo(() => S.balances.filter((b) => b.total > 0).map((b) => { const price = S.priceOf(b.coin); return { b, price, value: b.total * price }; }).sort((a, c) => c.value - a.value), [S.balances, S.priceOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const marginRows = useMemo(() => S.marginBalances.map((b) => { const value = marginUsd(b, S.priceOf); const p = S.priceOf(b.coin); return { b, price: p > 0 ? p : b.price, value }; }).sort((a, c) => c.value - a.value), [S.marginBalances, S.priceOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const spotTotal = spotRows.reduce((s, r) => s + r.value, 0);
  const marginTotal = marginRows.reduce((s, r) => s + r.value, 0);
  const total = spotTotal + marginTotal;
  const dust = <T extends { value: number; b: { total: number }; price: number }>(rows: T[]) => rows.filter((r) => !hideSmall || r.value >= 0.01 || r.b.total > 0 && r.price === 0);
  const shown = dust(spotRows);
  const shownMargin = dust(marginRows);

  const loadHist = useCallback(async () => {
    if (!S.wallet || !S.accountID) return;
    setHist((h) => ({ ...h, loading: true, err: null }));
    try {
      const [fills, orders] = await Promise.all([fetchFills(S.net, S.wallet.address, { limit: 50, aid: S.accountID }), fetchOrderHistory(S.net, S.wallet.address, undefined, 50, S.accountID)]);
      setHist({ fills, orders, err: null, loading: false });
    } catch (e: any) { setHist((h) => ({ ...h, err: e?.message ?? 'Failed to load history', loading: false })); }
  }, [S.wallet, S.accountID, S.net]);
  useEffect(() => { if ((tab === 'fills' || tab === 'hist') && hist.fills === null && !hist.loading) loadHist(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelMany = async (orders: OpenOrder[]) => {
    const items = orders.map((o) => ({ symbolID: S.symByName[o.symbol]?.id, orderID: o.orderID })).filter((x) => x.symbolID);
    if (!items.length) return;
    for (let i = 0; i < items.length; i += 100) {
      const res = await S.cancel(items.slice(i, i + 100));
      const bad = res.find((r) => r.code !== 0);
      if (bad) throw new Error(bad.error || `Cancel rejected (code ${bad.code})`);
    }
    await S.refreshAccount();
  };

  if (!S.wallet) return <Card><Empty icon={<Wallet className="h-6 w-6" />} title="Connect a wallet to see your portfolio" body="Balances, open orders and trade history come straight from your SoDEX account." action={<Button variant="primary" onClick={() => S.setUi('connect', true)}>Connect wallet</Button>} /></Card>;

  const stat = (k: string, v: React.ReactNode) => <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c]/90 p-4"><div className="text-xs text-zinc-500">{k}</div><div className="tnum mt-1 text-xl font-bold text-zinc-50">{v}</div></div>;

  const OrdersTable = ({ orders, cancellable }: { orders: OpenOrder[]; cancellable?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <thead><tr className="text-left text-[11px] uppercase tracking-wider text-zinc-600"><th className="px-4 py-2">Pair</th><th>Side</th><th>Type</th><th className="text-right">Price</th><th className="text-right">Size</th><th className="text-right">Filled</th><th className="px-4 text-right">{cancellable ? '' : 'Status'}</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.orderID + o.clOrdID} className="border-t border-white/[0.04]">
              <td className="px-4 py-2.5 font-semibold text-zinc-100">{S.symByName[o.symbol]?.display ?? o.symbol}</td>
              <td className={/buy/i.test(o.side) ? 'text-emerald-400' : 'text-rose-400'}>{o.side}</td>
              <td className="text-zinc-400">{o.type}{o.tif ? ` · ${o.tif}` : ''}</td>
              <td className="tnum text-right text-zinc-200">{o.price !== undefined ? px(o.price) : 'market'}</td>
              <td className="tnum text-right text-zinc-200">{o.qty !== undefined ? num(o.qty, 8) : '–'}</td>
              <td className="tnum text-right text-zinc-400">{num(o.executed, 8)}</td>
              <td className="px-4 text-right">{cancellable
                ? <Button size="sm" variant="danger" loading={busyId === o.orderID} onClick={async () => { setBusyId(o.orderID); try { await cancelMany([o]); S.toast('ok', 'Order cancelled.'); } catch (e: any) { S.toast('err', e?.message ?? 'Cancel failed'); } finally { setBusyId(null); } }}>Cancel</Button>
                : <Badge tone={/fill/i.test(o.status) ? 'emerald' : /cancel|reject|expire/i.test(o.status) ? 'zinc' : 'amber'}>{o.status || '–'}</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('Total value', usd(total))}
        {stat('Available USDC', usd(S.available(QUOTE)))}
        {stat('Open orders', String(S.openOrders.length))}
        {stat('Account', <span className="flex items-center gap-2">{S.accountID ? '#' + S.accountID : S.accountID === undefined ? '…' : '–'}<Badge tone={S.net === 'mainnet' ? 'amber' : 'zinc'}>{NETS[S.net].label}</Badge></span>)}
      </div>
      {S.accountErr && <ErrorBox msg={S.accountErr} onRetry={() => S.refreshAccount()} />}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-3">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'bal', label: 'Balances' }, { value: 'open', label: `Open orders${S.openOrders.length ? ` (${S.openOrders.length})` : ''}` }, { value: 'fills', label: 'Trades' }, { value: 'hist', label: 'Order history' }]} />
          <div className="flex items-center gap-2">
            {tab === 'bal' && <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={hideSmall} onChange={(e) => setHideSmall(e.target.checked)} className="accent-orange-500" />Hide dust</label>}
            {tab === 'open' && S.openOrders.length > 0 && <Button size="sm" variant="danger" onClick={() => setConfirmAll(true)}>Cancel all</Button>}
            <Button size="sm" variant="ghost" onClick={() => { S.refreshAccount(); if (tab === 'fills' || tab === 'hist') loadHist(); }} aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {tab === 'bal' && (
          <div>
            <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
              <h3 className="text-sm font-semibold text-zinc-100">Spot (spendable for swaps)</h3>
              <div className="tnum text-sm font-semibold text-zinc-50">{spotRows.length ? usd(spotTotal) : ''}</div>
            </div>
            {S.accountID === undefined ? <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={'s' + i} className="h-10" />)}</div>
              : shown.length === 0 ? <Empty icon={<Wallet className="h-5 w-5" />} title={S.accountID === null ? 'No SoDEX spot account yet' : 'No spot balances yet'} body={S.accountID === null ? 'Deposit on SoDEX to create your spot account. It will appear here automatically.' : 'Deposit assets on SoDEX to start trading.'} />
              : (
                <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-zinc-600"><th className="px-4 py-2">Asset</th><th className="text-right">Total</th><th className="text-right">In orders</th><th className="text-right">Value</th><th className="px-4" /></tr></thead>
                  <tbody>{shown.map(({ b, price, value }) => {
                    const sym = S.symByCoin[b.coin];
                    return (
                      <tr key={b.id} className="border-t border-white/[0.04]">
                        <td className="px-4 py-3"><div className="flex items-center gap-2.5"><TokenIcon name={coinLabel(b.coin)} size={28} /><div><div className="font-semibold text-zinc-100">{coinLabel(b.coin)}</div><div className="tnum text-[11px] text-zinc-500">{price ? '$' + px(price) : ''}</div></div></div></td>
                        <td className="tnum text-right text-zinc-100">{num(b.total, 8)}</td>
                        <td className="tnum text-right text-zinc-500">{b.locked ? num(b.locked, 8) : '–'}</td>
                        <td className="tnum text-right text-zinc-200">{price ? usd(value) : '–'}</td>
                        <td className="px-4 text-right">{sym && <Button size="sm" onClick={() => { S.setSelected(sym.name); S.setView('swap'); }}>Trade</Button>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>
              )}

            <div className="mt-2 border-t border-white/[0.06] px-4 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-100">Margin & Futures</h3>
                <div className="tnum text-sm font-semibold text-zinc-50">{marginRows.length ? usd(marginTotal) : ''}</div>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">Used as margin on SoDEX. Move it to Spot on <a href={SODEX_SITE} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-200">sodex.com</a> to swap it.</p>
            </div>
            {S.marginErr ? <div className="p-4"><ErrorBox msg={S.marginErr} onRetry={() => S.refreshAccount()} /></div>
              : !S.marginLoaded ? <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={'m' + i} className="h-10" />)}</div>
              : shownMargin.length === 0 ? <Empty icon={<Layers className="h-5 w-5" />} title="No Margin & Futures balances" body="Balances used as margin on SoDEX will show up here." />
              : (
                <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-zinc-600"><th className="px-4 py-2">Asset</th><th className="text-right">Total</th><th className="text-right">Value</th></tr></thead>
                  <tbody>{shownMargin.map(({ b, price, value }) => (
                    <tr key={b.id || b.coin} className="border-t border-white/[0.04]">
                      <td className="px-4 py-3"><div className="flex items-center gap-2.5"><TokenIcon name={coinLabel(b.coin)} size={28} /><div><div className="font-semibold text-zinc-100">{coinLabel(b.coin)}</div><div className="tnum text-[11px] text-zinc-500">{price ? '$' + px(price) : ''}</div></div></div></td>
                      <td className="tnum text-right text-zinc-100">{num(b.total, 8)}</td>
                      <td className="tnum px-4 text-right text-zinc-200">{price ? usd(value) : '–'}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
          </div>
        )}

        {tab === 'open' && (S.openOrders.length === 0 ? <Empty icon={<History className="h-5 w-5" />} title="No open orders" body="Limit orders and bot orders that are resting on the book show up here." /> : <OrdersTable orders={S.openOrders} cancellable />)}

        {(tab === 'fills' || tab === 'hist') && (hist.err ? <div className="p-4"><ErrorBox msg={hist.err} onRetry={loadHist} /></div> : hist.loading && hist.fills === null ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div> : tab === 'hist'
          ? ((hist.orders ?? []).length ? <OrdersTable orders={hist.orders ?? []} /> : <Empty icon={<History className="h-5 w-5" />} title="No order history" />)
          : ((hist.fills ?? []).length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-xs">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-zinc-600"><th className="px-4 py-2">Time</th><th>Pair</th><th>Side</th><th className="text-right">Price</th><th className="text-right">Size</th><th className="px-4 text-right">Fee</th></tr></thead>
              <tbody>{(hist.fills ?? []).map((f) => (
                <tr key={f.tradeID} className="border-t border-white/[0.04]">
                  <td className="tnum px-4 py-2.5 text-zinc-500">{new Date(f.time).toLocaleString('en-GB', { hour12: false })}</td>
                  <td className="font-semibold text-zinc-100">{S.symByName[f.symbol]?.display ?? f.symbol}</td>
                  <td className={/buy/i.test(f.side) ? 'text-emerald-400' : 'text-rose-400'}>{f.side}{f.maker ? ' · maker' : ''}</td>
                  <td className="tnum text-right text-zinc-200">{px(f.price)}</td><td className="tnum text-right text-zinc-200">{num(f.qty, 8)}</td>
                  <td className="tnum px-4 text-right text-zinc-500">{num(f.fee, 6)} {coinLabel(f.feeCoin)}</td>
                </tr>))}</tbody>
            </table></div>) : <Empty icon={<History className="h-5 w-5" />} title="No trades yet" />))}
      </Card>

      <ReviewModal open={confirmAll} onClose={() => setConfirmAll(false)} title="Cancel all open orders" confirmLabel="Cancel all orders"
        warn="This also cancels orders placed by your bots. Running grid bots will report the missing orders and stop."
        rows={[{ k: 'Orders to cancel', v: String(S.openOrders.length) }]}
        run={async () => { await cancelMany(S.openOrders); return 'All open orders cancelled.'; }} />
    </div>
  );
}

/* ═════════════════════════ SoSoValue client (news · ETF flows · sectors) ═════════════════════════
 * Browser → /api/soso/* (this app's server) → SoSoValue. The API key exists only in the server environment. */

type NewsItem = { id: string; title: string; url: string; time: number; summary: string };
type EtfDay = { date: string; inflow: number };
type SectorRow = { name: string; change: number; dominance: number };

const NOT_CONFIGURED = -2;

async function sosoGet(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15_000);
  try {
    const r = await fetch(`/api/soso${path}${qs ? '?' + qs : ''}`, { signal: ctl.signal });
    if (r.status === 503) throw new ApiError('SoSoValue is not configured on this deployment.', NOT_CONFIGURED);
    if (!r.ok) throw new ApiError(r.status === 429 ? 'SoSoValue rate limit reached. Try again shortly.' : 'SoSoValue data is unavailable right now.');
    const j = await r.json();
    if (j && typeof j === 'object' && 'code' in j && Number(j.code) !== 0 && Number(j.code) !== 200) throw new ApiError(String(j.message ?? j.msg ?? 'SoSoValue error'));
    return j && typeof j === 'object' && 'data' in j ? j.data : j;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e?.name === 'AbortError' ? 'SoSoValue request timed out.' : 'Could not load SoSoValue data.');
  } finally { clearTimeout(t); }
}
const asList = (d: any): any[] => (Array.isArray(d) ? d : Array.isArray(d?.list) ? d.list : Array.isArray(d?.items) ? d.items : []);
const toMs = (v: unknown) => { const n = Number(v); return !n ? 0 : n < 1e12 ? n * 1000 : n; };

async function fetchNews(): Promise<NewsItem[]> {
  const d = await sosoGet('/news/hot');
  return asList(d).map((x) => ({
    id: String(x.id ?? x.source_link ?? Math.random()), title: String(x.title ?? '').trim(), url: String(x.source_link ?? x.url ?? ''),
    time: toMs(x.release_time ?? x.time), summary: String(x.content ?? '').replace(/<[^>]+>/g, '').trim(),
  })).filter((x) => x.title);
}
async function fetchEtf(symbol: 'BTC' | 'ETH'): Promise<EtfDay[]> {
  const d = await sosoGet('/etfs/summary-history', { symbol, country_code: 'US', limit: 7 });
  return asList(d).map((x) => ({ date: String(x.date ?? x.timestamp ?? ''), inflow: asNum(x.total_net_inflow) })).filter((x) => x.date);
}
async function fetchSectors(): Promise<{ sectors: SectorRow[]; spotlight: { name: string; change: number }[] }> {
  const d = await sosoGet('/currencies/sector-spotlight');
  return {
    sectors: asList(d?.sector).map((x) => ({ name: String(x.name), change: asNum(x.change_pct_24h) * 100, dominance: asNum(x.marketcap_dom) * 100 })),
    spotlight: asList(d?.spotlight).map((x) => ({ name: String(x.name), change: asNum(x.change_pct_24h) * 100 })),
  };
}


type Feed<T> = { data: T | null; err: string | null; loading: boolean; notConfigured: boolean; reload: () => void };
function useFeed<T>(loader: () => Promise<T>, deps: unknown[] = []): Feed<T> {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [off, setOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setErr(null);
    loader().then((d) => { if (live) { setData(d); setOff(false); } }).catch((e) => { if (live) { setData(null); setOff(e?.code === NOT_CONFIGURED); setErr(e?.code === NOT_CONFIGURED ? null : e?.message ?? String(e)); } }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, ...deps]);
  return { data, err, loading, notConfigured: off, reload: () => setN((x) => x + 1) };
}

const ago = (ms: number) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

/** Shown whenever a SoSoValue feed is loading, not configured, or down: an honest empty state, never sample data. */
function FeedState({ feed, what }: { feed: Feed<any>; what: string }) {
  if (feed.loading && !feed.data) return <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (feed.notConfigured) return (
    <div className="p-4 text-center">
      <KeyRound className="mx-auto mb-2 h-5 w-5 text-orange-400" />
      <div className="text-sm font-semibold text-zinc-100">{what[0].toUpperCase() + what.slice(1)} unavailable</div>
      <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-zinc-500">The SoSoValue connection is not set up on this deployment yet, so this panel stays empty (no sample data).</p>
    </div>
  );
  if (feed.err) return <div className="p-3"><ErrorBox msg={feed.err} onRetry={feed.reload} /></div>;
  return null;
}

/* ═════════════════════════ page views: home · markets hub · cross-chain · bots · guide ═════════════════════════ */

const PageTitle = ({ icon, title, sub, right }: { icon: React.ReactNode; title: string; sub: string; right?: React.ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] text-orange-400 shadow-[0_0_28px_-10px_rgba(249,115,22,0.7)] [&>svg]:h-6 [&>svg]:w-6">{icon}</div>
    <div className="min-w-0 flex-1"><h1 className="text-[26px] font-bold leading-tight tracking-tight text-zinc-50">{title}</h1><p className="text-[13px] text-zinc-400">{sub}</p></div>
    {right}
  </div>
);

const OrangeTab = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button role="tab" aria-selected={active} onClick={onClick}
    className={cx('h-9 rounded-lg px-4 text-[13px] font-semibold transition', active ? 'bg-gradient-to-b from-orange-400 to-orange-500 text-black shadow-[0_8px_24px_-10px_rgba(249,115,22,0.9)]' : 'border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]')}>{children}</button>
);

/* ───────── home ───────── */

function Watchlist() {
  const S = useS();
  const rows = S.favs.map((n) => ({ sym: S.symByName[n], t: S.tickers[n] })).filter((r) => r.sym);
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Your watchlist</h2>
        <button onClick={() => S.setView('markets')} className="text-xs font-medium text-orange-300 hover:text-orange-200">{rows.length ? 'Edit in Markets' : 'Browse Markets'}</button>
      </div>
      {rows.length === 0 ? <p className="text-[13px] text-zinc-400">Tap the star next to any pair in Markets to keep it here, with a one-tap trade and price alert.</p> : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map(({ sym, t }) => (
            <li key={sym.name} className="flex items-center gap-3 py-2">
              <TokenIcon name={sym.base} size={26} />
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-zinc-100">{sym.display}</div>
                <div className="tnum text-xs text-zinc-400">{t ? num(t.last, 6) : '–'} {t && <span className={t.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%</span>}</div>
                {!sym.halted && <button type="button" onClick={() => goToTradeCheck(S, sym.name)} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:text-orange-200"><ShieldCheck className="h-3 w-3" />Check this trade</button>}
              </div>
              <button aria-label={`Set a price alert for ${sym.display}`} title="Price alert" onClick={() => { S.setSelected(sym.name); skillIntent.tab = 'alerts'; S.setView('skills'); }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 transition hover:border-orange-500/50 hover:text-orange-300"><AlertIcon size={20} /></button>
              <Button size="sm" onClick={() => { S.setSelected(sym.name); S.setView('swap'); }}>Trade</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HomeView() {
  const S = useS();
  const tiles = [
    { icon: <Layers className="h-5 w-5" />, t: 'SoDEX Mainnet', s: 'Real markets & routes' },
    { icon: <Wallet className="h-5 w-5" />, t: 'Your Wallet', s: 'You sign every order' },
    { icon: <LineChart className="h-5 w-5" />, t: 'Preview First', s: 'See route & estimate' },
    { icon: <ShieldCheck className="h-5 w-5" />, t: 'No Seed Phrase', s: 'We never ask for it' },
  ];
  return (
    <div className="relative">
      <div className="grid items-center gap-6 md:grid-cols-[1.1fr_1fr]">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.07] px-3 py-1.5 text-xs font-medium text-zinc-200"><Logo size={16} glow={false} />Powered by SoDEX Mainnet</span>
          <h1 className="mt-5 text-6xl font-extrabold leading-none tracking-tight text-zinc-50 sm:text-7xl">So<span className="bg-gradient-to-b from-orange-300 to-orange-600 bg-clip-text text-transparent">SwapDEX</span></h1>
          <p className="mt-4 text-2xl font-bold text-zinc-50">Swap on SoDEX mainnet.</p>
          <p className="mt-2 max-w-md text-lg leading-snug text-zinc-300">Live routes, a preview before you sign, your wallet.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" className="!rounded-lg" onClick={() => S.setView('swap')}>Start Swapping<ArrowUpRight className="h-4 w-4" /></Button>
            <Button size="lg" className="!rounded-lg !border-orange-500/40" onClick={() => S.setView('markets')}>View Markets</Button>
            <InstallButton className="!h-12 !rounded-lg !px-4 !text-sm" />
          </div>
        </Reveal>
        <div className="relative mx-auto grid h-[300px] w-full max-w-[420px] place-items-center" aria-hidden>
          <div className="absolute bottom-6 h-24 w-72 rounded-[50%] border border-orange-500/40 bg-gradient-to-b from-orange-500/25 to-transparent blur-[1px] shadow-[0_0_80px_10px_rgba(249,115,22,0.35)]" />
          <div className="absolute bottom-12 h-16 w-56 rounded-[50%] border border-orange-400/50 bg-black/70" />
          <div className="relative -mt-8"><Logo size={230} /></div>
        </div>
      </div>
      <Reveal><div className="mt-6 grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <Card className="p-4">
          <div className="text-sm font-semibold text-zinc-100">Check before you swap</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">SoSwapDEX checks the live SoDEX order book before every spot trade and shows the real cost, slippage and risk. Then you sign each order yourself. Funds stay in your SoDEX account; we never hold them or ask for a seed phrase.</p>
          <p className="mt-2 text-xs text-zinc-500">You need a wallet and a funded SoDEX account. Trading runs on <b className="text-orange-300">Mainnet</b> with real funds, so start small.</p>
        </Card>
        <Onboarding />
      </div></Reveal>
      <Reveal><div className="mt-3"><Watchlist /></div></Reveal>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <AnimatedCard key={t.t} delay={0.08 * i} className="rounded-2xl border border-orange-500/15 bg-white/[0.03] p-4 text-center">
            <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]">{t.icon}</div>
            <div className="text-sm font-semibold text-zinc-100">{t.t}</div><div className="text-[11px] text-zinc-500">{t.s}</div>
          </AnimatedCard>
        ))}
      </div>
    </div>
  );
}

/* ───────── markets hub (pairs · news · ETF flows · sectors) ───────── */

/** Map a headline to a live SoDEX pair only when a listed base (or a well-known name for one) actually appears in the text. */
const NEWS_BASE_ALIAS: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', dogecoin: 'DOGE', ripple: 'XRP',
  cardano: 'ADA', litecoin: 'LTC', polkadot: 'DOT', avalanche: 'AVAX', chainlink: 'LINK',
};
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function pairFromText(text: string, syms: Sym[]): string | null {
  if (!text || !syms.length) return null;
  const byBase = new Map<string, Sym>();
  for (const sym of syms) { if (!sym.halted && !byBase.has(sym.base)) byBase.set(sym.base, sym); }
  const hits: { name: string; index: number; len: number }[] = [];
  const push = (sym: Sym, re: RegExp, src: string) => { const m = re.exec(src); if (m) hits.push({ name: sym.name, index: m.index, len: m[0].length }); };
  for (const [base, sym] of byBase) {
    if (base.length < 2) continue;
    push(sym, new RegExp(`(?<![A-Za-z0-9_])${escapeRe(base)}(?![A-Za-z0-9_])`, 'i'), text);
  }
  for (const [alias, base] of Object.entries(NEWS_BASE_ALIAS)) {
    const sym = byBase.get(base); if (sym) push(sym, new RegExp(`\\b${escapeRe(alias)}\\b`, 'i'), text);
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.index - b.index || b.len - a.len);
  return hits[0].name;
}

function NewsRow({ n, big }: { n: NewsItem; big?: boolean }) {
  const S = useS();
  const pair = pairFromText(`${n.title} ${n.summary}`, S.syms);
  const display = pair ? (S.symByName[pair]?.display ?? pair) : null;
  const inner = (
    <>
      <div className="grid h-14 w-[72px] shrink-0 place-items-center rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/20 via-orange-500/5 to-sky-500/10 text-orange-300"><LineChart className="h-6 w-6" /></div>
      <div className="min-w-0">
        <div className={cx('font-semibold leading-snug text-zinc-100', big ? 'text-sm' : 'line-clamp-2 text-[13px]')}>{n.title}</div>
        {big && n.summary && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-500">{n.summary}</p>}
        <div className="mt-1 text-[11px] text-zinc-500">{n.time ? ago(n.time) : ''}{n.time ? ' • ' : ''}News</div>
      </div>
    </>
  );
  const cls = 'flex gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]';
  return (
    <div className="rounded-xl">
      {n.url ? <a href={n.url} target="_blank" rel="noreferrer" className={cls}>{inner}</a> : <div className={cls}>{inner}</div>}
      {pair && display && (
        <div className="flex justify-end px-2 pb-2">
          <button type="button" onClick={() => goToTradeCheck(S, pair)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-300 transition hover:text-orange-200">
            <ShieldCheck className="h-3.5 w-3.5" />Check this trade<span className="font-medium text-zinc-500">· {display}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function NewsPanel({ onAll, limit = 3 }: { onAll?: () => void; limit?: number }) {
  const feed = useFeed(fetchNews);
  return (
    <Card>
      <CardHead title="SoSoValue News" icon={<Newspaper className="h-4 w-4 text-orange-400" />} right={onAll && <button onClick={onAll} className="text-[11px] font-medium text-orange-400 hover:underline">View All →</button>} />
      <FeedState feed={feed} what="news" />
      {feed.data && (feed.data.length ? <div className="p-2">{feed.data.slice(0, limit).map((n) => <NewsRow key={n.id} n={n} />)}</div> : <Empty icon={<Newspaper className="h-5 w-5" />} title="No news right now" />)}
    </Card>
  );
}

function EtfTradeCheck({ symbol }: { symbol: 'BTC' | 'ETH' }) {
  const S = useS();
  const pair = S.syms.find((s) => s.base === symbol && !s.halted)?.name;
  if (!pair) return null;
  const display = S.symByName[pair]?.display ?? pair;
  return (
    <button type="button" onClick={() => goToTradeCheck(S, pair)}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-300 transition hover:text-orange-200">
      <ShieldCheck className="h-3.5 w-3.5" />Check this trade<span className="font-medium text-zinc-500">· {display}</span>
    </button>
  );
}

function EtfCard({ symbol }: { symbol: 'BTC' | 'ETH' }) {
  const feed = useFeed(() => fetchEtf(symbol), [symbol]);
  const days = feed.data ? [...feed.data].reverse() : [];
  const max = Math.max(1, ...days.map((d) => Math.abs(d.inflow)));
  const sum = days.reduce((s, d) => s + d.inflow, 0);
  return (
    <Card>
      <CardHead title={`${symbol} spot ETFs (US)`} icon={<BarChart3 className="h-4 w-4 text-orange-400" />} right={feed.data && days.length ? <span className={cx('tnum text-xs font-semibold', sum >= 0 ? 'text-emerald-400' : 'text-rose-400')}>7d {sum >= 0 ? '+' : '-'}${compact(Math.abs(sum))}</span> : undefined} />
      <FeedState feed={feed} what="ETF flows" />
      {feed.data && (days.length ? (
        <div className="p-4">
          <div className="flex h-32 items-center gap-2">
            {days.map((d) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-center" title={`${d.date}: ${usd(d.inflow, 0)}`}>
                <div className="flex h-1/2 w-full items-end">{d.inflow > 0 && <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${(d.inflow / max) * 100}%` }} />}</div>
                <div className="flex h-1/2 w-full items-start">{d.inflow < 0 && <div className="w-full rounded-b bg-rose-500/80" style={{ height: `${(-d.inflow / max) * 100}%` }} />}</div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2">{days.map((d) => <div key={d.date} className="flex-1 text-center text-[10px] text-zinc-600">{d.date.slice(5, 10)}</div>)}</div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-zinc-500">Latest day: <span className={cx('tnum font-semibold', days[days.length - 1].inflow >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{days[days.length - 1].inflow >= 0 ? '+' : '-'}${compact(Math.abs(days[days.length - 1].inflow))}</span> net inflow</div>
            <EtfTradeCheck symbol={symbol} />
          </div>
        </div>
      ) : <Empty icon={<BarChart3 className="h-5 w-5" />} title="No ETF data returned" />)}
    </Card>
  );
}

function SectorsPanel() {
  const feed = useFeed(fetchSectors);
  return (
    <Card>
      <CardHead title="Sector moves (24h)" icon={<Grid3x3 className="h-4 w-4 text-orange-400" />} />
      <FeedState feed={feed} what="sectors" />
      {feed.data && (feed.data.sectors.length ? (
        <div>
          {feed.data.spotlight.length > 0 && <div className="flex flex-wrap gap-2 border-b border-white/[0.06] p-3">{feed.data.spotlight.slice(0, 8).map((s) => <span key={s.name} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300">{s.name} <Chg pct={s.change} /></span>)}</div>}
          {[...feed.data.sectors].sort((a, b) => b.dominance - a.dominance).slice(0, 20).map((s) => (
            <div key={s.name} className="grid grid-cols-[1.4fr_1fr_.8fr] items-center gap-3 border-t border-white/[0.04] px-4 py-2.5 first:border-t-0 text-sm">
              <span className="truncate text-zinc-100">{s.name}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-orange-500" style={{ width: `${clamp(s.dominance, 1, 100)}%` }} /></div>
              <div className="text-right"><Chg pct={s.change} /></div>
            </div>
          ))}
        </div>
      ) : <Empty icon={<Grid3x3 className="h-5 w-5" />} title="No sector data returned" />)}
    </Card>
  );
}

function MarketsHub() {
  const [tab, setTab] = useState<'markets' | 'news' | 'etf' | 'sectors'>('markets');
  const news = useFeed(fetchNews);
  return (
    <div>
      <PageTitle icon={<BarChart3 className="h-8 w-8" />} title="Markets" sub="Live markets, SoSoValue news, ETF flows, and sector moves." />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        <OrangeTab active={tab === 'markets'} onClick={() => setTab('markets')}>Markets</OrangeTab>
        <OrangeTab active={tab === 'news'} onClick={() => setTab('news')}>News</OrangeTab>
        <OrangeTab active={tab === 'etf'} onClick={() => setTab('etf')}>ETF Flows</OrangeTab>
        <OrangeTab active={tab === 'sectors'} onClick={() => setTab('sectors')}>Sectors</OrangeTab>
      </div>
      <AnimatedTabs activeKey={tab}>
      {tab === 'markets' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <MarketsView />
          <NewsPanel onAll={() => setTab('news')} />
        </div>
      )}
      {tab === 'news' && (
        <Card>
          <CardHead title="SoSoValue News" icon={<Newspaper className="h-4 w-4 text-orange-400" />} />
          <FeedState feed={news} what="news" />
          {news.data && (news.data.length ? <div className="grid gap-1 p-2 md:grid-cols-2">{news.data.slice(0, 20).map((n) => <NewsRow key={n.id} n={n} big />)}</div> : <Empty icon={<Newspaper className="h-5 w-5" />} title="No news right now" />)}
        </Card>
      )}
      {tab === 'etf' && <div className="grid gap-4 md:grid-cols-2"><EtfCard symbol="BTC" /><EtfCard symbol="ETH" /></div>}
      {tab === 'sectors' && <SectorsPanel />}
      </AnimatedTabs>
    </div>
  );
}

/* ───────── cross-chain (add funds / withdraw) ───────── */

const CHAINS = [
  { id: 'eth', name: 'Ethereum', native: 'ETH', short: 'ETH', evm: 1, sodex: 'ETH', usdc: { addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', dec: 6 }, usdt: { addr: '0xdAC17F958D2ee523a2206206994597C13D831ec7', dec: 6 }, gas: 0.003 },
  { id: 'base', name: 'Base', native: 'ETH', short: 'BASE', evm: 8453, sodex: 'BASE', usdc: { addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', dec: 6 }, gas: 0.0002 },
  { id: 'arb', name: 'Arbitrum', native: 'ETH', short: 'ARB', evm: 42161, sodex: 'ARBITRUM', usdc: { addr: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', dec: 6 }, usdt: { addr: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', dec: 6 }, gas: 0.0002 },
  { id: 'bnb', name: 'BNB Chain', native: 'BNB', short: 'BNB', evm: 56, sodex: 'BSC_BNB', usdc: { addr: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', dec: 18 }, usdt: { addr: '0x55d398326f99059fF775485246999027B3197955', dec: 18 }, gas: 0.002 },
  { id: 'matic', name: 'Polygon', native: 'POL', short: 'POL', evm: 137, sodex: 'MATIC', usdc: { addr: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', dec: 6 }, gas: 0.05 },
  { id: 'sol', name: 'Solana', native: 'SOL', short: 'SOL', sodex: 'SOL' },
  { id: 'btc', name: 'Bitcoin', native: 'BTC', short: 'BTC', sodex: 'BTC' },
] as { id: string; name: string; native: string; short: string; evm?: number; sodex: string; usdc?: { addr: string; dec: number }; usdt?: { addr: string; dec: number }; gas?: number }[];

type SourceTok = 'native' | 'usdc' | 'usdt';

/** Reads the connected wallet's balance of the chosen source token on its own chain. Only works while the wallet is on that chain. */
function useSourceBalance(chain: (typeof CHAINS)[number], token: SourceTok) {
  const S = useS();
  const [bal, setBal] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'switch' | 'na' | 'err'>('idle');
  const provider = S.wallet?.info.provider;
  const owner = S.wallet?.address;
  const walletChain = S.wallet?.chainId;
  const erc20 = token === 'usdc' ? chain.usdc : token === 'usdt' ? chain.usdt : undefined;
  useEffect(() => {
    setBal(null);
    if (!provider || !owner) { setState('idle'); return; }
    if (!chain.evm) { setState('na'); return; }
    if (token !== 'native' && !erc20) { setState('na'); return; }
    if (walletChain !== chain.evm) { setState('switch'); return; }
    let stop = false; setState('loading');
    const load = async () => {
      try {
        let v: number;
        if (token === 'native') {
          const hex: string = await provider.request({ method: 'eth_getBalance', params: [owner, 'latest'] });
          v = Number(BigInt(hex)) / 1e18;
        } else {
          const data = '0x70a08231' + owner.toLowerCase().replace('0x', '').padStart(64, '0');
          const hex: string = await provider.request({ method: 'eth_call', params: [{ to: erc20!.addr, data }, 'latest'] });
          v = Number(BigInt(hex)) / 10 ** erc20!.dec;
        }
        if (!stop) { setBal(v); setState('ok'); }
      } catch { if (!stop) setState('err'); }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [provider, owner, walletChain, chain, token, erc20]);
  return { bal, state };
}
const selectCls = 'h-11 w-full appearance-none rounded-lg border border-white/10 bg-black/50 pl-11 pr-9 text-sm font-medium text-zinc-100 outline-none focus:border-orange-500/60';

const ROUTE_FEE_BPS = Number(process.env.NEXT_PUBLIC_ROUTE_FEE_BPS || '0') > 0 ? Number(process.env.NEXT_PUBLIC_ROUTE_FEE_BPS) : 0;

function sourceTokenKey(chain: (typeof CHAINS)[number], token: SourceTok) {
  return token === 'native' ? chain.native : token === 'usdc' ? 'USDC' : 'USDT';
}

function sourceTokens(chain: (typeof CHAINS)[number]): { id: SourceTok; label: string }[] {
  const out: { id: SourceTok; label: string }[] = [{ id: 'native', label: chain.native }];
  if (chain.usdc) out.push({ id: 'usdc', label: 'USDC' });
  if (chain.usdt) out.push({ id: 'usdt', label: 'USDT' });
  return out;
}

function destKeyOf(token: string, chain: string) { return `${token}:${chain}`; }
function parseDestKey(k: string): { token: string; chain: string } | null {
  const i = k.lastIndexOf(':');
  if (i <= 0) return null;
  return { token: k.slice(0, i), chain: k.slice(i + 1) };
}

async function fetchRouteQuote(body: Record<string, unknown>): Promise<NormalizedQuote> {
  const r = await fetch('/api/route/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error || !j?.steps) throw new Error(typeof j?.error === 'string' ? j.error : FRIENDLY_NO_ROUTE);
  return j as NormalizedQuote;
}

async function fetchRouteStatus(q: { provider: RouteProvider; requestId?: string; txHash?: string; fromChain?: number; toChain?: number }): Promise<NormalizedStatus> {
  const u = new URL('/api/route/status', window.location.origin);
  u.searchParams.set('provider', q.provider);
  if (q.provider === 'relay' && q.requestId) u.searchParams.set('requestId', q.requestId);
  if (q.provider === 'lifi' && q.txHash) u.searchParams.set('txHash', q.txHash);
  if (q.fromChain) u.searchParams.set('fromChain', String(q.fromChain));
  if (q.toChain) u.searchParams.set('toChain', String(q.toChain));
  const r = await fetch(u.pathname + u.search);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) throw new Error(typeof j?.error === 'string' ? j.error : 'Could not check that route right now.');
  return j as NormalizedStatus;
}

async function switchWalletChain(provider: any, chainId: number) {
  const hex = '0x' + chainId.toString(16);
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    return;
  } catch (e: any) {
    if (isUserRejected(e)) throw e;
    const add = CHAIN_META[chainId]?.add;
    if (!add) throw e;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, ...add }] });
  }
}

function providerLabel(p: RouteProvider) {
  return p === 'relay' ? 'Quoted by Relay' : 'Quoted by LI.FI';
}

function formatEta(sec: number | null) {
  if (sec == null) return 'Depends on network confirmations';
  if (sec < 60) return `About ${Math.max(1, Math.round(sec))} seconds`;
  const m = Math.max(1, Math.round(sec / 60));
  return m === 1 ? 'About 1 minute' : `About ${m} minutes`;
}

function RoutableDestinations() {
  return evmDestinationsFor().filter((a) => findRouteToken(a.token, a.chain));
}


/** SoDEX balances for the connected wallet. Spot (S.balances) and Margin & Futures (S.marginBalances) clear the moment the wallet disconnects. */
function SodexBalances({ compact = false }: { compact?: boolean }) {
  const S = useS();
  const spotRows = useMemo(() => S.balances.filter((b) => b.total > 0).map((b) => ({ b, value: b.total * S.priceOf(b.coin) })).sort((a, c) => c.value - a.value), [S.balances, S.priceOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const marginRows = useMemo(() => S.marginBalances.map((b) => ({ b, value: marginUsd(b, S.priceOf) })).sort((a, c) => c.value - a.value), [S.marginBalances, S.priceOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const spotTotal = spotRows.reduce((t, r) => t + r.value, 0);
  const marginTotal = marginRows.reduce((t, r) => t + r.value, 0);
  const total = spotTotal + marginTotal;
  if (!S.wallet) return <div className="rounded-2xl border border-white/[0.07] bg-black/40 p-4"><Empty icon={<Wallet className="h-5 w-5" />} title="Connect a wallet to see your SoDEX balances" body="Your assets appear here while the wallet is connected and clear when you disconnect." action={<Button variant="primary" onClick={() => S.setUi('connect', true)}>Connect wallet</Button>} /></div>;
  const rowList = (rows: { b: { coin: string; total: number; locked?: number }; value: number }[], locked: boolean) => (
    <ul className={cx('ss-stagger mt-2 divide-y divide-white/[0.05]', compact && 'max-h-60 overflow-y-auto')}>
      {rows.map(({ b, value }, i) => (
        <li key={b.coin} style={{ '--i': Math.min(i, 8) } as React.CSSProperties} className="flex items-center gap-3 py-2">
          <TokenIcon name={coinLabel(b.coin)} size={24} />
          <div className="min-w-0 flex-1 text-[13px] font-medium text-zinc-100">{coinLabel(b.coin)}{locked && (b.locked ?? 0) > 0 && <span className="ml-2 text-[11px] font-normal text-zinc-500">{num(b.locked!, 4)} in orders</span>}</div>
          <div className="text-right"><div className="tnum text-[13px] text-zinc-100">{num(b.total, 6)}</div><div className="tnum text-[11px] text-zinc-500">{value > 0 ? usd(value) : ''}</div></div>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="rounded-2xl border border-orange-500/20 bg-black/40 p-4">
      <div className="flex items-baseline justify-between gap-3"><h3 className="text-sm font-semibold text-zinc-100">Your SoDEX balance</h3><div className="tnum text-sm font-semibold text-zinc-50">{spotRows.length || marginRows.length ? usd(total) : ''}</div></div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Spot (spendable for swaps)</h4>
        <div className="tnum text-xs font-semibold text-zinc-300">{spotRows.length ? usd(spotTotal) : ''}</div>
      </div>
      {S.accountID === undefined ? <div className="mt-2 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        : spotRows.length === 0 ? <p className="mt-2 text-[13px] text-zinc-500">{S.accountID === null ? 'No SoDEX spot account for this wallet yet. Deposit on SoDEX to create it.' : 'No spot balances yet. Deposit assets on SoDEX to start trading.'}</p>
        : rowList(spotRows, true)}

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-white/[0.06] pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Margin & Futures</h4>
        <div className="tnum text-xs font-semibold text-zinc-300">{marginRows.length ? usd(marginTotal) : ''}</div>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">Used as margin on SoDEX. Move it to Spot on <a href={SODEX_SITE} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-200">sodex.com</a> to swap it.</p>
      {S.marginErr ? <div className="mt-2"><ErrorBox msg={S.marginErr} onRetry={() => S.refreshAccount()} /></div>
        : !S.marginLoaded ? <div className="mt-2 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        : marginRows.length === 0 ? <p className="mt-2 text-[13px] text-zinc-500">No Margin & Futures balances.</p>
        : rowList(marginRows, false)}
    </div>
  );
}

function CrossChainView() {
  const S = useS();
  const [tab, setTab] = useState<'add' | 'withdraw'>('add');
  return (
    <div className="mx-auto max-w-[960px]">
      <PageTitle icon={<Link2 className="h-8 w-8" />} title="Cross-Chain" sub="Add funds from another chain, or withdraw to one. You sign every transaction. SoSwapDEX never holds your funds."
        right={<span className="inline-flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/[0.06] px-3 py-2 text-xs font-medium text-zinc-100"><AlertTriangle className="h-4 w-4 text-orange-400" />Estimate only</span>} />
      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: 'add', label: 'Add funds' }, { value: 'withdraw', label: 'Withdraw' }]} /></div>
      {tab === 'add' ? <AddFundsPanel /> : <WithdrawPanel />}
      <div className="mt-4"><SodexBalances /></div>
    </div>
  );
}

function AddFundsPanel() {
  const S = useS();
  const [chainId, setChainId] = useState('eth');
  const chain = CHAINS.find((c) => c.id === chainId)!;
  const [tokenKey, setTokenKey] = useState<SourceTok>('native');
  const tokens = sourceTokens(chain);
  const srcKey = sourceTokenKey(chain, tokenKey);
  const [amount, setAmount] = useState('');
  const advice = useMemo(() => bestDestination(srcKey, chain.sodex, true), [srcKey, chain.sodex]);
  const defaultDest = advice.kind === 'unsupported' ? destKeyOf('USDC', 'BASE') : destKeyOf(advice.asset.token, advice.asset.chain);
  const [destSel, setDestSel] = useState(defaultDest);
  useEffect(() => { setDestSel(defaultDest); setQuote(null); setQuoteErr(''); }, [defaultDest]);
  const dest = parseDestKey(destSel);
  const destAsset = dest ? findAsset(dest.token, dest.chain) : undefined;
  const destTokenRef = dest ? findRouteToken(dest.token, dest.chain) : undefined;
  const srcTokenRef = chain.evm ? findRouteToken(srcKey, chain.sodex) : undefined;
  const amt = parseFloat(amount) || 0;
  const usdApprox = STABLECOINS.has(srcKey) ? amt : (S.priceOf(srcKey) > 0 ? amt * S.priceOf(srcKey) : null);
  const destUsd = destAsset && STABLECOINS.has(destAsset.token) ? (S.priceOf(destAsset.token) > 0 ? amt * (S.priceOf(srcKey) || 0) : amt) : null;
  const gate = destAsset ? minDepositGate({ token: destAsset.token, chain: destAsset.chain, amount: destAsset.token === srcKey ? amt : (destUsd ?? amt), usdApprox: destUsd }) : { ok: false as const, reason: 'unsupported' as const, message: 'SoDEX will not credit this. Choose a supported token and chain instead.' };
  // For routed swaps, out amount is unknown until quoted; still enforce the dest min on a same-token route using the source amount as a conservative check only when tokens match.
  const sameToken = destAsset?.token === srcKey;
  const preGate = destAsset
    ? (sameToken ? minDepositGate({ token: destAsset.token, chain: destAsset.chain, amount: amt, usdApprox: STABLECOINS.has(destAsset.token) ? (usdApprox ?? amt) : null }) : { ok: amt > 0 } as const)
    : gate;
  const { bal, state: balState } = useSourceBalance(chain, tokenKey);
  const reserve = tokenKey === 'native' ? chain.gas ?? 0 : 0;
  const usable = bal == null ? 0 : Math.max(0, bal - reserve);
  const pick = (f: number) => setAmount(String(Math.floor(usable * f * 1e6) / 1e6));
  const over = bal != null && amt > bal;
  const evmOk = !!chain.evm;
  const direct = destAsset && chain.sodex === destAsset.chain && srcKey === destAsset.token;
  const [quote, setQuote] = useState<NormalizedQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState('');
  const [quoting, setQuoting] = useState(false);
  const icon = (n: string) => <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><TokenIcon name={n} size={22} /></span>;

  const destChoices = RoutableDestinations();
  const unsupportedPick = dest && !destAsset;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-2xl border border-orange-500/20 bg-black/40 p-4">
        <Field label="From chain">
          <div className="relative">{icon(chain.native)}
            <select aria-label="From chain" value={chainId} onChange={(e) => { setChainId(e.target.value); setTokenKey('native'); setAmount(''); setQuote(null); setQuoteErr(''); }} className={selectCls}>
              {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          </div>
        </Field>
        <Field label="Token">
          <div className="flex gap-2">
            <div className="relative w-[44%]">{icon(srcKey)}
              <select aria-label="Source token" value={tokenKey} onChange={(e) => { setTokenKey(e.target.value as SourceTok); setQuote(null); setQuoteErr(''); }} className={selectCls}>
                {tokens.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
            <AmountInput value={amount} onChange={(v) => { setAmount(v); setQuote(null); setQuoteErr(''); }} className="flex-1 !h-11 [&_input]:text-right [&_input]:text-base [&_input]:font-semibold" label="Amount" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]" aria-live="polite">
            <span className="tnum text-zinc-500">
              {balState === 'ok' && bal != null ? <>Your {srcKey} on {chain.name}: <span className="text-zinc-200">{num(bal, 6)}</span></>
                : balState === 'loading' ? 'Reading your balance…'
                : balState === 'switch' ? `Switch your wallet to ${chain.name} to see this balance.`
                : balState === 'na' ? `${chain.name} balance can't be read from an Ethereum wallet here. Type the amount.`
                : balState === 'err' ? 'Could not read your balance. Type the amount.'
                : 'Connect a wallet to see your balance.'}
            </span>
            <div className="flex gap-1">{[0.1, 0.25, 0.5, 1].map((f) => (
              <button key={f} type="button" disabled={balState !== 'ok' || !usable} onClick={() => { pick(f); setQuote(null); setQuoteErr(''); }}
                className="ss-btn rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-orange-500 hover:text-orange-400 disabled:opacity-40">{f === 1 ? 'MAX' : `${f * 100}%`}</button>))}</div>
          </div>
          {over && <p role="alert" className="mt-1.5 text-[11px] text-rose-400">That is more than your {srcKey} balance on {chain.name}.</p>}
        </Field>
        <Field label="Lands in your wallet as" hint="Then you deposit it on SoDEX.">
          <div className="relative">{icon(dest?.token ?? 'USDC')}
            <select aria-label="Destination token and chain" value={destSel} onChange={(e) => { setDestSel(e.target.value); setQuote(null); setQuoteErr(''); }} className={selectCls}>
              {destChoices.map((a) => <option key={destKeyOf(a.token, a.chain)} value={destKeyOf(a.token, a.chain)}>{a.token} on {CHAIN_LABEL[a.chain] ?? a.chain}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          </div>
        </Field>
        {destAsset && (
          <ul className="space-y-1 rounded-xl border border-white/[0.07] bg-black/30 p-3 text-[12px] text-zinc-300">
            <li>Minimum deposit on SoDEX: <span className="tnum text-zinc-100">{destAsset.minDeposit} {destAsset.token}</span> <span className="text-zinc-500">(per SoDEX docs)</span></li>
            <li>SoDEX withdrawal fee from this chain: <span className="tnum text-zinc-100">{totalWithdrawFee(destAsset)} {destAsset.token}</span> <span className="text-zinc-500">(per SoDEX docs)</span></li>
          </ul>
        )}
        {unsupportedPick && <Notice tone="error">SoDEX will not credit this. Choose a listed token and chain instead.</Notice>}
        {amount && preGate && 'ok' in preGate && !preGate.ok && <Notice tone="error">{'message' in preGate ? preGate.message : 'Enter a valid amount.'}</Notice>}
        {!evmOk && (
          <Notice tone="warn">This Ethereum wallet cannot send from {chain.name}. Send manually from a {chain.name} wallet, or pick an Ethereum-compatible source chain. If SoDEX lists {srcKey} on {chain.name}, you can deposit it directly on sodex.com.</Notice>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-orange-500/20 bg-black/40 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-orange-300"><Info className="h-4 w-4" />Add funds</h3>
        <Notice tone="warn">Deposit happens on SoDEX. SoSwapDEX never deposits for you and never holds your funds. A deposit below the minimum, or on an unsupported token or chain, can be lost or not credited.</Notice>
        {advice.kind === 'route' && <p className="text-[12px] leading-relaxed text-zinc-400">{advice.reason}</p>}
        {direct && destAsset && (
          <div className="space-y-3">
            <p className="text-[13px] text-zinc-300">This token is already accepted on {CHAIN_LABEL[destAsset.chain]}. No bridge is needed — deposit it on SoDEX from this wallet.</p>
            <DepositHandoff token={destAsset.token} chain={destAsset.chain} amount={amt > 0 ? String(amt) : null} minDeposit={destAsset.minDeposit} />
          </div>
        )}
        {!direct && evmOk && (
          <RouteExecute
            disabled={!S.wallet || !amt || over || !destAsset || !destTokenRef || !srcTokenRef || !chain.evm || (preGate && 'ok' in preGate && !preGate.ok)}
            needWallet={!S.wallet}
            destAsset={destAsset}
            pay={`${amount || '0'} ${srcKey}`}
            onQuote={async () => {
              if (!S.wallet || !srcTokenRef || !destTokenRef || !destAsset || !chain.evm) throw new Error('Connect a wallet first.');
              const smallest = toSmallest(amount, srcTokenRef.decimals);
              if (!smallest) throw new Error('Enter a valid amount.');
              setQuoting(true); setQuoteErr(''); setQuote(null);
              try {
                const q = await fetchRouteQuote({
                  user: S.wallet.address, recipient: S.wallet.address,
                  originChainId: chain.evm, destinationChainId: destTokenRef.chainId,
                  originCurrency: srcTokenRef.address, destinationCurrency: destTokenRef.address,
                  amount: smallest, originToken: srcKey, destinationToken: destAsset.token,
                  destinationSodexChain: destAsset.chain, purpose: 'fund',
                });
                setQuote(q);
                return q;
              } catch (e: any) {
                const msg = e?.message && !looksInternal(e.message) ? e.message : FRIENDLY_NO_ROUTE;
                setQuoteErr(msg);
                throw new Error(msg);
              } finally { setQuoting(false); }
            }}
            quote={quote}
            quoteErr={quoteErr}
            quoting={quoting}
            afterSuccess
          />
        )}
      </div>
    </div>
  );
}

function looksInternal(msg: string) {
  return /stack|internal|exception|status code|ECONN|api key|x-api-key|li\.quest|relay\.link|INTERNAL/i.test(msg);
}

function DepositHandoff({ token, chain, amount, minDeposit, received }: { token: string; chain: string; amount: string | null; minDeposit: number; received?: string | null }) {
  const S = useS();
  const [baseline, setBaseline] = useState<number | null>(null);
  const [credited, setCredited] = useState(false);
  const coin = token;
  const spot = S.balances.find((b) => b.coin.replace(/^v/i, '').toUpperCase() === coin.toUpperCase());
  const current = spot?.total ?? 0;
  useEffect(() => {
    setBaseline(current);
    setCredited(false);
  }, [S.wallet?.address, coin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (baseline != null && current > baseline + 1e-12) setCredited(true);
  }, [current, baseline]);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/30 p-3 text-[13px] text-zinc-300">
        {received ? <div className="flex justify-between gap-3"><span className="text-zinc-400">Arrived in your wallet, about</span><span className="tnum text-zinc-100">{received} {token}</span></div> : null}
        {amount && !received ? <div className="flex justify-between gap-3"><span className="text-zinc-400">Amount to deposit</span><span className="tnum text-zinc-100">{amount} {token}</span></div> : null}
        <div className="flex justify-between gap-3"><span className="text-zinc-400">Deposit on</span><span className="text-zinc-100">{CHAIN_LABEL[chain] ?? chain}</span></div>
        <div className="flex justify-between gap-3"><span className="text-zinc-400">Minimum deposit</span><span className="tnum text-zinc-100">{minDeposit} {token} <span className="text-zinc-500">(per SoDEX docs)</span></span></div>
      </div>
      <Button variant="primary" className="w-full" onClick={() => window.open(SODEX_SITE, '_blank', 'noopener,noreferrer')}>Open SoDEX deposit <ExternalLink className="h-4 w-4" /></Button>
      <p className="text-[11px] leading-relaxed text-zinc-500">Deposits credit your SoDEX Spot account after SoDEX screens the source of funds. This screen only watches your Spot balance. It does not move funds.</p>
      {credited ? <Notice tone="ok">Credited. Your SoDEX Spot balance for {token} has increased.</Notice>
        : S.wallet ? <p className="text-[11px] text-zinc-500">Waiting to see a Spot credit for {token}…</p> : null}
    </div>
  );
}

function RouteExecute({ disabled, needWallet, destAsset, onQuote, quote, quoteErr, quoting, afterSuccess, purpose = 'fund', pay }: {
  disabled: boolean; needWallet: boolean; destAsset?: SodexAsset | { token: string; chain: string; minDeposit: number };
  onQuote: () => Promise<NormalizedQuote>; quote: NormalizedQuote | null; quoteErr: string; quoting: boolean; afterSuccess?: boolean; purpose?: 'fund' | 'onward'; pay?: string;
}) {
  const S = useS();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRoute | null>(() => loadSavedRoute());
  const [status, setStatus] = useState<RouteStatusValue | null>(saved?.status ?? null);
  const [execErr, setExecErr] = useState('');

  useEffect(() => {
    if (!saved || saved.status === 'success' || saved.status === 'failure' || saved.status === 'refund') return;
    let stop = false; let n = 0;
    const tick = async () => {
      if (stop) return;
      try {
        const s = await fetchRouteStatus({ provider: saved.provider, requestId: saved.requestId, txHash: saved.txHash, fromChain: saved.originChainId, toChain: saved.destinationChainId });
        if (stop) return;
        setStatus(s.status);
        const next = { ...saved, status: s.status, destTxHash: s.destTxHash } as SavedRoute;
        storeSavedRoute(next); setSaved(next);
        if (s.status === 'success' || s.status === 'failure' || s.status === 'refund') return;
      } catch { /* keep polling quietly */ }
      n += 1;
      window.setTimeout(tick, nextPollMs(n));
    };
    tick();
    return () => { stop = true; };
  }, [saved?.txHash, saved?.requestId, saved?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (q: NormalizedQuote) => {
    if (!S.wallet) throw new Error('Connect a wallet first.');
    if (q.recipient.toLowerCase() !== S.wallet.address.toLowerCase()) throw new Error(FRIENDLY_BAD_RECIPIENT);
    const provider = S.wallet.info.provider;
    const steps = q.steps;
    if (steps.some((s) => s.kind === 'signature' && (s.signature?.kind === 'unknown' || !s.signature))) {
      throw new Error(UNKNOWN_SIG_MSG);
    }
    setBusy(true); setExecErr(''); setProgress('');
    let hash: string | undefined;
    try {
      const execSteps = await maybeWithApproval(provider, S.wallet.address, q);
      for (let i = 0; i < execSteps.length; i++) {
        const step = execSteps[i];
        setProgress(`Step ${i + 1} of ${execSteps.length}: ${step.action}`);
        if (step.chainId && S.wallet.chainId !== step.chainId) {
          setProgress(`Step ${i + 1} of ${execSteps.length}: switch to ${CHAIN_META[step.chainId]?.name ?? 'the required network'}`);
          try { await switchWalletChain(provider, step.chainId); }
          catch (e) { throw isUserRejected(e) ? e : new Error('Your wallet could not switch to the required network.'); }
        }
        if (step.kind === 'manual') throw new Error(step.description);
        if (step.kind === 'signature') throw new Error(UNKNOWN_SIG_MSG);
        const params = txParams(step);
        if (!params) throw new Error('This route step could not be prepared. Nothing was sent.');
        params.from = S.wallet.address;
        const sent: string = await provider.request({ method: 'eth_sendTransaction', params: [params] });
        hash = sent;
        setTxHash(sent);
      }
      const row = savedFromQuote(q, { txHash: hash, status: 'pending' });
      storeSavedRoute(row); setSaved(row); setStatus('pending');
      setProgress('The route is in progress. You can leave this page and come back — the status is saved in this browser.');
    } catch (e: any) {
      const msg = friendlyExecError(e);
      setExecErr(msg);
      setStatus(isUserRejected(e) ? null : 'failure');
    } finally { setBusy(false); }
  };

  const showHandoff = afterSuccess && destAsset && (status === 'success' || (status === 'pending' && txHash));
  return (
    <div className="space-y-3">
      {needWallet && <Button variant="primary" className="w-full" onClick={() => S.setUi('connect', true)}>Connect a wallet</Button>}
      {!needWallet && !quote && (
        <Button variant="primary" className="w-full" loading={quoting} disabled={disabled || quoting} onClick={() => onQuote().catch(() => {})}>Get route estimate</Button>
      )}
      {quoteErr && <Notice tone="error">{quoteErr}</Notice>}
      {quote && (
        <>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{providerLabel(quote.provider)} · {ESTIMATE_NOTE}</p>
          <CostReceipt
            pay={pay || 'This route'}
            get={`${quote.outAmount} ${quote.outToken}`}
            lines={[
              { k: 'You receive, about', v: `${quote.outAmount} ${quote.outToken}` },
              { k: 'Minimum received', v: `${quote.minOut} ${quote.outToken}` },
              { k: 'Route fee, about', v: quote.feeUsd != null ? usd(quote.feeUsd, 2) : 'Included in the estimate' },
              { k: 'Time, about', v: formatEta(quote.etaSec) },
              ...(ROUTE_FEE_BPS > 0 ? [{ k: 'SoSwapDEX route fee', v: `${ROUTE_FEE_BPS / 100}% of the input` }] : []),
            ]}
            total={quote.feeUsd != null ? usd(quote.feeUsd, 2) : 'See estimate'}
            totalPct={quote.feeUsd != null && Number(quote.outAmount) > 0 ? (quote.feeUsd / (Number(quote.outAmount) + quote.feeUsd)) * 100 : 0}
            notes={[ESTIMATE_NOTE, ...(ROUTE_FEE_BPS > 0 ? ['A SoSwapDEX route fee is included in this estimate.'] : [])]}
          />
          <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3 text-[12px] leading-relaxed text-zinc-300">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Recipient (your wallet)</div>
            <div className="mt-1 break-all font-mono text-[12px] text-zinc-100">{quote.recipient}</div>
            <p className="mt-2 text-zinc-500">Funds go only to this address, which is the wallet you connected. Check it before you sign.</p>
          </div>
          {quote.steps.length > 0 && (
            <ol className="space-y-1.5 text-[12px] text-zinc-400">
              {quote.steps.map((s, i) => <li key={i}><span className="text-orange-300">Step {i + 1} of {quote.steps.length}.</span> {s.action} {s.description && <span className="block text-zinc-500">{s.description}</span>}</li>)}
            </ol>
          )}
          <Button variant="primary" className="w-full" loading={busy} disabled={busy || status === 'pending' || status === 'success'} onClick={() => run(quote)}>
            {busy ? 'Waiting for your wallet…' : 'Sign and send'}
          </Button>
        </>
      )}
      {progress && <p className="text-[12px] text-zinc-400">{progress}</p>}
      {execErr && <Notice tone="error">{execErr}</Notice>}
      {txHash && quote && <p className="text-[12px]"><a className="text-orange-300 hover:text-orange-200" href={explorerTx(quote.originChainId, txHash)} target="_blank" rel="noreferrer">View transaction <ExternalLink className="inline h-3 w-3" /></a></p>}
      {status && <Notice tone={status === 'success' ? 'ok' : status === 'refund' ? 'warn' : status === 'failure' ? 'error' : 'info'}>{statusLabel(status)}</Notice>}
      {showHandoff && destAsset && status === 'success' && purpose === 'fund' && (
        <DepositHandoff token={destAsset.token} chain={'chain' in destAsset ? destAsset.chain : ''} amount={null} minDeposit={destAsset.minDeposit} received={quote?.outAmount ?? saved?.outAmount ?? null} />
      )}
    </div>
  );
}

async function maybeWithApproval(provider: any, owner: string, q: NormalizedQuote): Promise<RouteStep[]> {
  if (!needsApproval(q.originCurrency)) return q.steps;
  const first = q.steps.find((s) => s.kind === 'transaction' && s.tx);
  if (!first?.tx) return q.steps;
  const spender = first.tx.to;
  try {
    const hex: string = await provider.request({ method: 'eth_call', params: [{ to: q.originCurrency, data: allowanceCalldata(owner, spender) }, 'latest'] });
    if (BigInt(hex) >= BigInt(q.inAmountRaw)) return q.steps;
  } catch {
    // If allowance cannot be read, ask for approval as its own signed step rather than guessing.
  }
  return [approvalStep(q.originCurrency, spender, q.originChainId, owner), ...q.steps];
}

function WithdrawPanel() {
  const S = useS();
  const tokens = tokensWithWithdrawOptions();
  const [token, setToken] = useState('USDC');
  const rows = assetsForToken(token);
  const best = cheapestWithdraw(token);
  const [onwardChain, setOnwardChain] = useState('8453');
  const [onwardToken, setOnwardToken] = useState('USDC');
  const [onwardAmt, setOnwardAmt] = useState('');
  const [quote, setQuote] = useState<NormalizedQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState('');
  const [quoting, setQuoting] = useState(false);
  const destRef = findRouteToken(onwardToken, Number(onwardChain));
  // Origin for send-onward: the token just withdrawn, assumed in the user's wallet on a SoDEX EVM chain they pick.
  const [fromChain, setFromChain] = useState('1');
  const fromRef = findRouteToken(token, Number(fromChain)) || findRouteToken('USDC', Number(fromChain));
  const evmOrigins = QUOTE_CHAIN_IDS.map((id) => ({ id, label: CHAIN_META[id]?.name ?? String(id) }));
  const evmDests = evmOrigins;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-orange-500/20 bg-black/40 p-4">
        <Field label="Token to withdraw from SoDEX">
          <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><TokenIcon name={token} size={22} /></span>
            <select aria-label="Withdraw token" value={token} onChange={(e) => { setToken(e.target.value); setQuote(null); }} className={selectCls}>
              {tokens.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          </div>
        </Field>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
              <tr><th className="py-2 pr-3 font-medium">Chain</th><th className="py-2 pr-3 font-medium">Withdrawal fee</th><th className="py-2 pr-3 font-medium">Bridge fee</th><th className="py-2 pr-3 font-medium">Min withdrawal</th><th className="py-2 font-medium"></th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((r) => {
                const cheap = best && r.chain === best.chain && r.token === best.token;
                return (
                  <tr key={r.chain} className={cheap ? 'bg-emerald-500/[0.06]' : undefined}>
                    <td className="py-2 pr-3 text-zinc-100">{CHAIN_LABEL[r.chain] ?? r.chain}</td>
                    <td className="tnum py-2 pr-3 text-zinc-200">{r.withdrawFee} {r.token}</td>
                    <td className="tnum py-2 pr-3 text-zinc-200">{r.bridgeWithdrawFee} {r.token}</td>
                    <td className="tnum py-2 pr-3 text-zinc-200">{r.minWithdraw} {r.token}</td>
                    <td className="py-2 text-[11px] font-semibold text-emerald-300">{cheap ? 'Cheapest' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Fees and minimums are per SoDEX docs. Withdrawal itself stays on sodex.com.</p>
        <Button variant="primary" className="mt-3" onClick={() => window.open(SODEX_SITE, '_blank', 'noopener,noreferrer')}>Open SoDEX withdrawal <ExternalLink className="h-4 w-4" /></Button>
      </div>

      <div className="rounded-2xl border border-orange-500/20 bg-black/40 p-4">
        <h3 className="text-sm font-semibold text-orange-300">Send onward</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">After the withdrawal has arrived in this wallet, you can bridge it to another chain. You sign every step. SoSwapDEX never holds the funds.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Now in your wallet on">
            <div className="relative">{/* no icon offset issues */}
              <select aria-label="Origin chain after withdrawal" value={fromChain} onChange={(e) => { setFromChain(e.target.value); setQuote(null); }} className={cx(selectCls, '!pl-3')}>
                {evmOrigins.map((c) => <option key={c.id} value={String(c.id)}>{c.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </Field>
          <Field label="Send to">
            <div className="relative">
              <select aria-label="Destination chain" value={onwardChain} onChange={(e) => { setOnwardChain(e.target.value); setQuote(null); }} className={cx(selectCls, '!pl-3')}>
                {evmDests.map((c) => <option key={c.id} value={String(c.id)}>{c.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </Field>
          <Field label="Token to receive">
            <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><TokenIcon name={onwardToken} size={22} /></span>
              <select aria-label="Onward token" value={onwardToken} onChange={(e) => { setOnwardToken(e.target.value); setQuote(null); }} className={selectCls}>
                {['USDC', 'USDT', 'ETH', 'BNB'].filter((t) => findRouteToken(t, Number(onwardChain))).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </Field>
          <Field label="Amount to send">
            <AmountInput value={onwardAmt} onChange={(v) => { setOnwardAmt(v); setQuote(null); }} label="Amount to send onward" />
          </Field>
        </div>
        <div className="mt-3">
          <RouteExecute
            disabled={!S.wallet || !fromRef || !destRef || !(parseFloat(onwardAmt) > 0)}
            needWallet={!S.wallet}
            destAsset={{ token: onwardToken, chain: CHAIN_META[Number(onwardChain)]?.sodex ?? '', minDeposit: 0 }}
            pay={`${onwardAmt || '0'} ${fromRef?.symbol ?? token}`}
            quoting={quoting}
            quote={quote}
            quoteErr={quoteErr}
            purpose="onward"
            afterSuccess={false}
            onQuote={async () => {
              if (!S.wallet || !fromRef || !destRef) throw new Error('Connect a wallet first.');
              const smallest = toSmallest(onwardAmt, fromRef.decimals);
              if (!smallest) throw new Error('Enter a valid amount.');
              setQuoting(true); setQuoteErr(''); setQuote(null);
              try {
                const q = await fetchRouteQuote({
                  user: S.wallet.address, recipient: S.wallet.address,
                  originChainId: fromRef.chainId, destinationChainId: destRef.chainId,
                  originCurrency: fromRef.address, destinationCurrency: destRef.address,
                  amount: smallest, originToken: fromRef.symbol, destinationToken: destRef.symbol,
                  destinationSodexChain: CHAIN_META[destRef.chainId]?.sodex ?? '', purpose: 'onward',
                });
                setQuote(q);
                return q;
              } catch (e: any) {
                const msg = e?.message && !looksInternal(e.message) ? e.message : FRIENDLY_NO_ROUTE;
                setQuoteErr(msg);
                throw new Error(msg);
              } finally { setQuoting(false); }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ───────── bots (drafts only: dry-run previews, nothing is ever sent) ───────── */

type BotKind = 'dca' | 'grid' | 'signal' | 'setup';
type SetupDraft = {
  on: boolean; pair: string; entry: string; stop: string; tp1: string; tp2: string;
  qty: string; notional: string; riskPct: string; equity: string;
  grade: SetupGrade | ''; rr: string; trend: string; at: number;
};
type BotCfg = {
  dca: { on: boolean; pair: string; amount: string; every: 'hourly' | 'daily' | 'weekly' };
  grid: { on: boolean; pair: string; lower: string; upper: string; levels: string; budget: string };
  signal: { on: boolean; pair: string; asset: 'BTC' | 'ETH'; threshold: string };
  setup: SetupDraft;
};
const BOT_DEFAULT: BotCfg = {
  dca: { on: false, pair: '', amount: '25', every: 'daily' },
  grid: { on: false, pair: '', lower: '', upper: '', levels: '8', budget: '200' },
  signal: { on: false, pair: '', asset: 'BTC', threshold: '100000000' },
  setup: { on: false, pair: '', entry: '', stop: '', tp1: '', tp2: '', qty: '', notional: '', riskPct: '1', equity: '', grade: '', rr: '', trend: '', at: 0 },
};
const BOT_LS = 'soswap.bots.v1';
const EVERY_MS = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };

function BotPreview({ kind, cfg, sym, price }: { kind: BotKind; cfg: BotCfg; sym?: Sym; price: number }) {
  const S = useS();
  const sig = useFeed(() => fetchEtf(cfg.signal.asset), [cfg.signal.asset, kind]);
  const wrap = 'ss-fade mt-2 rounded-xl border border-white/[0.07] bg-black/30 p-3 text-xs';
  if (kind === 'setup') {
    const c = cfg.setup;
    if (!c.at) return <div className={wrap}><span className="text-zinc-500">Build a setup above and save it to see a draft preview here.</span></div>;
    return (
      <div className={wrap}>
        <div className="mb-2 font-semibold text-zinc-200">Saved setup for {sym?.display ?? c.pair} (draft)</div>
        <Row k="Grade" v={c.grade === 'no-trade' ? 'No trade' : (c.grade || '–')} />
        <Row k="Trend" v={c.trend || '–'} />
        <Row k="Entry / Stop" v={`${px(parseFloat(c.entry))} / ${px(parseFloat(c.stop))}`} />
        <Row k="TP1 / TP2" v={`${px(parseFloat(c.tp1))} / ${px(parseFloat(c.tp2))}`} />
        <Row k="Size" v={`${c.qty} ${sym?.base ?? ''} · ${usd(parseFloat(c.notional) || 0)}`} />
        <Row k="R:R to TP1" v={c.rr ? `1:${c.rr}` : '–'} />
        <Row k="Saved" v={`${ageText(c.at)} ago${Date.now() - c.at > 3_600_000 ? ' · prices are old, rebuild before trading' : ''}`} tone={Date.now() - c.at > 3_600_000 ? 'warn' : undefined} />
        <div className="mt-3"><Button size="sm" onClick={() => goToRoutePreview(S, c.pair, 'buy', c.notional)}>Preview route<ArrowUpRight className="h-3.5 w-3.5" /></Button></div>
      </div>
    );
  }
  if (!sym || !price) return <div className={wrap}><span className="text-zinc-500">Waiting for the live price of the selected pair…</span></div>;
  if (kind === 'dca') {
    const c = cfg.dca, amt = parseFloat(c.amount) || 0;
    return (
      <div className={wrap}>
        <div className="mb-2 font-semibold text-zinc-200">Draft preview: next 5 buys of {sym.display}</div>
        {Array.from({ length: 5 }).map((_, i) => <Row key={i} k={new Date(Date.now() + (i + 1) * EVERY_MS[c.every]).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} v={`${usd(amt)} ≈ ${num(amt / price, 6)} ${sym.base}`} />)}
        <div className="mt-2 border-t border-white/[0.06] pt-2"><Row k="Planned spend (5 runs)" v={usd(amt * 5)} /></div>
      </div>
    );
  }
  if (kind === 'grid') {
    const c = cfg.grid, lo = parseFloat(c.lower) || price * 0.9, hi = parseFloat(c.upper) || price * 1.1, n = clamp(Math.round(parseFloat(c.levels) || 0), 2, 40), per = (parseFloat(c.budget) || 0) / n;
    const rows = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
    return (
      <div className={wrap}>
        <div className="mb-2 font-semibold text-zinc-200">Draft ladder for {sym.display} ({usd(lo, 4)} – {usd(hi, 4)})</div>
        <div className="max-h-44 space-y-1 overflow-y-auto">{rows.map((p, i) => <Row key={i} k={<span className={p < price ? 'text-emerald-400' : 'text-rose-400'}>{p < price ? 'BUY' : 'SELL'} @ {px(p)}</span>} v={`${usd(per)} ≈ ${num(per / p, 6)} ${sym.base}`} />)}</div>
        <div className="mt-2 border-t border-white/[0.06] pt-2"><Row k="Spacing" v={`${((((hi - lo) / (n - 1)) / price) * 100).toFixed(2)}% of price`} /></div>
      </div>
    );
  }
  const th = parseFloat(cfg.signal.threshold) || 0;
  const last = sig.data?.[0];
  return (
    <div className={wrap}>
      <div className="mb-2 font-semibold text-zinc-200">Draft rule: {cfg.signal.asset} spot ETF net inflow vs ±{usd(th, 0)}</div>
      <FeedState feed={sig} what="ETF flows" />
      {last && <><Row k={`Latest day (${last.date.slice(0, 10)})`} v={`${last.inflow >= 0 ? '+' : '-'}$${compact(Math.abs(last.inflow))}`} tone={last.inflow >= 0 ? 'good' : 'bad'} />
        <Row k="Draft signal" v={last.inflow > th ? `Would BUY ${sym.base}` : last.inflow < -th ? `Would SELL ${sym.base}` : 'No signal'} tone={last.inflow > th ? 'good' : last.inflow < -th ? 'bad' : undefined} /></>}
    </div>
  );
}

function BotEditor({ kind, cfg, setCfg, onClose }: { kind: BotKind; cfg: BotCfg; setCfg: (c: BotCfg) => void; onClose: () => void }) {
  const S = useS();
  const upd = (patch: Partial<BotCfg[BotKind]>) => setCfg({ ...cfg, [kind]: { ...cfg[kind], ...patch } } as BotCfg);
  const c: any = cfg[kind];
  const inp = 'h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-orange-500/60';
  return (
    <Modal open onClose={onClose} title={`Edit ${kind === 'dca' ? 'DCA' : kind === 'grid' ? 'Grid' : kind === 'setup' ? 'AI Setup' : 'Signal'} bot (draft)`}>
      <div className="space-y-3">
        {kind !== 'setup' && <Field label="Pair"><select value={c.pair || S.selected} onChange={(e) => upd({ pair: e.target.value })} className={inp}>{S.syms.map((s) => <option key={s.name} value={s.name}>{s.display}</option>)}</select></Field>}
        {kind === 'setup' && <>
          <p className="text-[13px] text-zinc-400">This draft was saved from the AI Setup Builder. The levels stay as computed; rebuilding a setup overwrites them. Nothing is sent automatically.</p>
          {c.at ? <div className="space-y-1 rounded-xl border border-white/[0.07] bg-black/30 p-3 text-xs">
            <Row k="Pair" v={S.symByName[c.pair]?.display ?? c.pair} />
            <Row k="Grade" v={c.grade === 'no-trade' ? 'No trade' : (c.grade || '–')} />
            <Row k="Entry / Stop" v={`${px(parseFloat(c.entry))} / ${px(parseFloat(c.stop))}`} />
            <Row k="TP1 / TP2" v={`${px(parseFloat(c.tp1))} / ${px(parseFloat(c.tp2))}`} />
            <Row k="Size" v={`${usd(parseFloat(c.notional) || 0)} at ${c.riskPct || '1'}% risk`} />
          </div> : <Notice tone="info">No setup has been saved yet.</Notice>}
          <Button className="w-full" onClick={() => { setCfg({ ...cfg, setup: BOT_DEFAULT.setup }); onClose(); }}>Clear draft</Button>
        </>}
        {kind === 'dca' && <>
          <Field label="Amount per run (USDC)"><AmountInput value={c.amount} onChange={(v) => upd({ amount: v })} suffix="USDC" label="Amount per run" /></Field>
          <Field label="Interval"><Segmented value={c.every} onChange={(v) => upd({ every: v })} options={[{ value: 'hourly', label: 'Hourly' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} /></Field>
        </>}
        {kind === 'grid' && <>
          <div className="grid grid-cols-2 gap-3"><Field label="Lower price"><AmountInput value={c.lower} onChange={(v) => upd({ lower: v })} placeholder="auto −10%" label="Lower price" /></Field><Field label="Upper price"><AmountInput value={c.upper} onChange={(v) => upd({ upper: v })} placeholder="auto +10%" label="Upper price" /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Grid levels"><AmountInput value={c.levels} onChange={(v) => upd({ levels: v })} label="Levels" /></Field><Field label="Budget (USDC)"><AmountInput value={c.budget} onChange={(v) => upd({ budget: v })} label="Budget" /></Field></div>
        </>}
        {kind === 'signal' && <>
          <Field label="ETF asset"><Segmented value={c.asset} onChange={(v) => upd({ asset: v })} options={[{ value: 'BTC', label: 'BTC ETFs' }, { value: 'ETH', label: 'ETH ETFs' }]} /></Field>
          <Field label="Daily net inflow threshold (USD)" hint="buy above, sell below −threshold"><AmountInput value={c.threshold} onChange={(v) => upd({ threshold: v })} label="Threshold" /></Field>
        </>}
        <Notice tone="info">Draft only. Saving changes how the preview is calculated; no order is ever sent from this page.</Notice>
        <Button variant="primary" className="w-full" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

const SETUP_GRADE: Record<SetupGrade, { label: string; cls: string }> = {
  A: { label: 'Grade A', cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' },
  B: { label: 'Grade B', cls: 'border-sky-500/40 bg-sky-500/15 text-sky-300' },
  C: { label: 'Grade C', cls: 'border-orange-500/40 bg-orange-500/15 text-orange-300' },
  'no-trade': { label: 'No trade', cls: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
};
const TREND_LABEL: Record<string, string> = { up: 'Up', down: 'Down', sideways: 'Sideways', unknown: 'Unknown' };

type SetupCtx = NonNullable<Parameters<typeof computeSetup>[0]['context']>;

async function loadSetupContext(): Promise<SetupCtx & { etfBtc?: { date: string; inflow: number } | null; etfEth?: { date: string; inflow: number } | null }> {
  const ctx: SetupCtx & { etfBtc?: { date: string; inflow: number } | null; etfEth?: { date: string; inflow: number } | null } = {
    headlines: [], newsStatus: 'ok', etf: null, etfStatus: 'n/a', etfBtc: null, etfEth: null,
  };
  try {
    ctx.headlines = (await fetchNews()).map((n) => n.title).filter(Boolean);
  } catch (e: any) {
    ctx.headlines = [];
    ctx.newsStatus = e?.code === NOT_CONFIGURED ? 'unconfigured' : 'missing';
  }
  const one = async (asset: 'BTC' | 'ETH') => {
    try {
      const days = await fetchEtf(asset);
      const last = [...days].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      return last ? { date: last.date, inflow: last.inflow } : null;
    } catch (e: any) {
      return e?.code === NOT_CONFIGURED ? ('unconfigured' as const) : ('missing' as const);
    }
  };
  const [btc, eth] = await Promise.all([one('BTC'), one('ETH')]);
  if (btc === 'unconfigured' || eth === 'unconfigured') ctx.etfStatus = 'unconfigured';
  else if (btc === 'missing' && eth === 'missing') ctx.etfStatus = 'missing';
  else {
    ctx.etfBtc = typeof btc === 'object' ? btc : null;
    ctx.etfEth = typeof eth === 'object' ? eth : null;
  }
  return ctx;
}

function contextFor(base: string, shared: Awaited<ReturnType<typeof loadSetupContext>>): SetupCtx {
  const aliases = assetAliases(base);
  const headlines = (shared.headlines ?? []).filter((t) => {
    const low = t.toLowerCase();
    return aliases.some((a) => {
      const i = low.indexOf(a);
      if (i < 0) return false;
      const left = i === 0 || (low.charCodeAt(i - 1) < 97 || low.charCodeAt(i - 1) > 122);
      const right = i + a.length === low.length || (low.charCodeAt(i + a.length) < 97 || low.charCodeAt(i + a.length) > 122);
      return left && right;
    });
  }).slice(0, 3);
  const asset = etfAssetFor(base);
  const flow = asset === 'BTC' ? shared.etfBtc : asset === 'ETH' ? shared.etfEth : null;
  return {
    headlines,
    newsStatus: shared.newsStatus,
    etf: asset && flow ? { asset, date: flow.date, inflow: flow.inflow } : null,
    etfStatus: asset ? (shared.etfStatus === 'unconfigured' || shared.etfStatus === 'missing' ? shared.etfStatus : (flow ? 'ok' : 'missing')) : 'n/a',
  };
}

function setupExplain(res: SetupOut) {
  const nt = res.grade === 'no-trade';
  const n = (v: number | null, d = 6) => (v != null && Number.isFinite(v) ? +v.toPrecision(d) : null);
  const lv = (v: number, d = 6) => (nt ? null : n(v, d));
  return {
    pair: res.display,
    timeframe: '1 hour',
    grade: res.grade,
    trend: res.trend,
    ema20: n(res.ema20),
    ema50: n(res.ema50),
    atr: n(res.atr),
    support: n(res.support),
    resistance: n(res.resistance),
    resistance2: n(res.resistance2),
    entry: lv(res.entry),
    stop: lv(res.stop),
    takeProfit1: lv(res.tp1),
    takeProfit2: lv(res.tp2),
    rewardToRiskTp1: lv(res.rr1, 4),
    rewardToRiskTp2: lv(res.rr2, 4),
    positionQty: lv(res.qty),
    positionUsdc: lv(res.notional, 6),
    maxLossUsdc: lv(res.maxLoss, 6),
    stopDistancePct: n(res.stopDistPct, 4),
    spreadPct: n(res.spreadPct, 4),
    priceImpactPct: n(res.impactPct, 4),
    bookCoveragePct: n(res.coveragePct, 4),
    candlesUsed: res.candlesUsed,
    reasons: res.reasons,
    warnings: res.flags.map((f) => f.text),
    news: res.newsNote,
    etf: res.etfNote || undefined,
  };
}

/* ───────── Arm and confirm: watches a setup while the tab is open, then asks you to confirm. Never places an order. ───────── */

const ageText = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'under a minute' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
type ArmGrade = 'A' | 'B';
type Armed = {
  pair: string; display: string; minGrade: ArmGrade; maxUsd: number; equity: number; riskPct: number;
  armedAt: number; expiresAt: number; status: 'watching' | 'ready' | 'expired'; ready?: { at: number; res: SetupOut }; checks: number; lastCheck?: number;
};
const ARM_LS = 'soswap.armed.v1';
const ARM_EVERY_MS = 45_000;
const ARM_FRESH_MS = 3 * 60_000;
const gradeRank = (g: SetupGrade) => (g === 'A' ? 3 : g === 'B' ? 2 : g === 'C' ? 1 : 0);
type ArmApi = { armed: Armed | null; arm: (a: Omit<Armed, 'armedAt' | 'status' | 'checks'>) => void; disarm: () => void; recheck: () => Promise<void>; checking: boolean };
const ArmCtx = createContext<ArmApi | null>(null);
const useArm = () => { const c = useContext(ArmCtx); if (!c) throw new Error('ArmHost missing'); return c; };

function ArmHost({ children }: { children: React.ReactNode }) {
  const S = useS();
  const alerts = useContext(AlertsCtx);
  const [armed, setArmed] = useState<Armed | null>(null);
  const [checking, setChecking] = useState(false);
  const loaded = useRef(false);
  const busy = useRef(false);
  const fails = useRef(0);
  const sRef = useRef(S); sRef.current = S;
  useEffect(() => {
    const a = lsGet<Armed | null>(ARM_LS, null);
    setArmed(a && a.pair ? (a.status === 'watching' && Date.now() > a.expiresAt ? { ...a, status: 'expired' } : a) : null);
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) lsSet(ARM_LS, armed); }, [armed]);

  const check = useCallback(async () => {
    const a = armed;
    if (!a || a.status !== 'watching' || busy.current) return;
    const St = sRef.current;
    if (Date.now() > a.expiresAt) { setArmed({ ...a, status: 'expired' }); St.toast('info', `Armed setup for ${a.display} expired. Nothing was placed.`); return; }
    const sym = St.symByName[a.pair];
    if (!sym || sym.halted) return;
    busy.current = true; setChecking(true);
    try {
      const [klines, book] = await Promise.all([fetchKlines(St.net, sym.name, '1h', 80), fetchBook(St.net, sym.name, 50)]);
      const t = St.tickers[sym.name];
      const res = computeSetup({
        pair: sym.name, display: sym.display, base: sym.base, candles: klines, bids: book.bids, asks: book.asks,
        last: t?.last ?? 0, quoteVol: t?.quoteVol ?? 0, takerFee: sym.taker, halted: sym.halted,
        minNotional: parseFloat(sym.minNotional) || 0, equity: a.equity, riskPct: a.riskPct, interval: '1h',
        builderFeePct: BUILDER_ID ? BUILDER_FEE / 1000 : 0, maxNotional: a.maxUsd,
      });
      fails.current = 0;
      const ok = res.grade !== 'no-trade' && gradeRank(res.grade) >= gradeRank(a.minGrade);
      setArmed((cur) => {
        if (!cur || cur.status !== 'watching' || cur.armedAt !== a.armedAt) return cur;
        return ok ? { ...cur, status: 'ready', ready: { at: Date.now(), res }, checks: cur.checks + 1, lastCheck: Date.now() } : { ...cur, checks: cur.checks + 1, lastCheck: Date.now() };
      });
      if (ok) {
        try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('SoSwapDEX setup ready', { body: `${sym.display} grade ${res.grade}. Open SoSwapDEX to review. Nothing has been placed.`, icon: '/icons/icon-192.png' }); } catch { /* ignore */ }
      }
    } catch {
      fails.current += 1;
      if (fails.current === 4) St.toast('err', 'The armed setup cannot read live market data right now. It keeps trying until it expires.');
    } finally { busy.current = false; setChecking(false); }
  }, [armed]);

  useEffect(() => {
    if (!armed || armed.status !== 'watching') return;
    const t0 = setTimeout(check, 1500);
    const id = setInterval(check, ARM_EVERY_MS);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, [armed?.armedAt, armed?.status, check]); // eslint-disable-line react-hooks/exhaustive-deps

  const api: ArmApi = {
    armed, checking,
    arm: (a) => { fails.current = 0; setArmed({ ...a, armedAt: Date.now(), status: 'watching', checks: 0 }); },
    disarm: () => setArmed(null),
    recheck: async () => { setArmed((c) => (c ? { ...c, status: 'watching', ready: undefined } : c)); },
  };

  const ready = armed?.status === 'ready' ? armed.ready : undefined;
  const [alertsOn, setAlertsOn] = useState(true);
  const fresh = !!ready && Date.now() - ready.at < ARM_FRESH_MS;
  const r = ready?.res;
  return (
    <ArmCtx.Provider value={api}>
      {children}
      <Modal open={!!r} onClose={() => setArmed((c) => (c ? { ...c, status: 'expired', ready: undefined } : c))} title={r ? `Setup ready: ${r.display}` : 'Setup ready'}>
        {r && (
          <div className="space-y-3">
            <Notice tone="ok">Conditions you armed were met (grade {r.grade}, minimum {armed?.minGrade}). Nothing has been placed. You decide.</Notice>
            <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/30 p-3 text-sm">
              <Row k="Entry (expected fill)" v={px(r.entry)} />
              <Row k="Stop (you place it)" v={px(r.stop)} tone="bad" />
              <Row k="TP1 / TP2" v={`${px(r.tp1)} / ${px(r.tp2)}`} tone="good" />
              <Row k="R:R after fees" v={`1:${r.rr1.toFixed(2)} · 1:${r.rr2.toFixed(2)}`} />
              <Row k="Size" v={`${Number(r.qty.toPrecision(5))} ${r.base} · ${usd(r.notional)}`} />
              <Row k="Loss if price reaches the stop" v={usd(r.maxLoss)} tone="bad" />
              <Row k="Spread / impact" v={`${r.spreadPct.toFixed(2)}% / ${r.impactPct.toFixed(2)}%`} />
              <Row k="Numbers from" v={`${ageText(ready!.at)} ago`} tone={fresh ? undefined : 'warn'} />
            </div>
            {r.flags.length > 0 && <FlagList flags={r.flags} />}
            <p className="text-[12px] leading-relaxed text-amber-300/90">The exchange side only takes market and limit orders here, so no stop-loss is placed for you. Tick the box below to get a price alert at the stop and at TP1, and keep this tab open.</p>
            <label className="flex cursor-pointer items-start gap-2.5 text-[12px] text-zinc-300"><input type="checkbox" checked={alertsOn} onChange={(e) => setAlertsOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-500" /><span>Set price alerts at the stop and at TP1</span></label>
            {!fresh && <Notice tone="warn">These numbers are more than 3 minutes old. Re-check before you trade.</Notice>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!fresh} onClick={() => {
                if (alertsOn && alerts) { alerts.add({ symbol: r.pair, dir: 'below', price: +r.stop.toPrecision(8) }); alerts.add({ symbol: r.pair, dir: 'above', price: +r.tp1.toPrecision(8) }); }
                setArmed((c) => (c ? { ...c, status: 'expired', ready: undefined } : c));
                goToRoutePreview(S, r.pair, 'buy', String(Math.round(r.notional * 100) / 100));
              }}>Preview route<ArrowUpRight className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => { void api.recheck(); }}>Re-check</Button>
              <Button onClick={() => setArmed(null)}>Dismiss</Button>
            </div>
          </div>
        )}
      </Modal>
    </ArmCtx.Provider>
  );
}

function ArmModal({ open, onClose, res, equity, riskPct }: { open: boolean; onClose: () => void; res: SetupOut; equity: number; riskPct: number }) {
  const S = useS();
  const { arm, armed } = useArm();
  const [grade, setGrade] = useState<ArmGrade>('B');
  const [maxUsd, setMaxUsd] = useState('');
  const [hours, setHours] = useState<'1' | '4' | '12' | '24'>('4');
  const [ack, setAck] = useState(false);
  useEffect(() => { if (open) { setAck(false); setMaxUsd(String(Math.floor(Math.min(res.notional, equity) * 100) / 100)); } }, [open, res.pair]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxN = parseFloat(maxUsd) || 0;
  const bad = !(maxN > 0) ? 'Enter a maximum order value in USDC.' : maxN > equity ? 'The maximum order cannot be larger than your account size.' : '';
  return (
    <Modal open={open} onClose={onClose} title={`Arm ${res.display}`}>
      <div className="space-y-3.5">
        <p className="text-[13px] leading-relaxed text-zinc-400">Arming lets SoSwapDEX watch {res.display} while this tab is open. When a fresh check meets your minimum grade, it shows you the exact numbers and asks you to confirm. <b className="text-zinc-200">It never places an order by itself.</b></p>
        <Field label="Minimum grade"><Segmented value={grade} onChange={setGrade} options={[{ value: 'B', label: 'B or better' }, { value: 'A', label: 'A only' }]} /></Field>
        <Field label="Maximum order value" hint={`risking ${riskPct}% of ${usd(equity, 0)}`}><AmountInput value={maxUsd} onChange={setMaxUsd} suffix="USDC" label="Maximum order value in USDC" /></Field>
        <Field label="Stays armed for"><Segmented value={hours} onChange={setHours} options={[{ value: '1', label: '1 h' }, { value: '4', label: '4 h' }, { value: '12', label: '12 h' }, { value: '24', label: '24 h' }]} /></Field>
        <ul className="list-disc space-y-1 rounded-xl border border-white/[0.07] bg-black/30 py-3 pl-8 pr-3 text-[12px] leading-relaxed text-zinc-400">
          <li>It only runs while this tab is open and awake. Close the tab and it stops.</li>
          <li>No stop-loss is placed on the exchange. You must watch the stop price or use the alert.</li>
          <li>Prices can gap past your stop, so a loss can be bigger than the number shown.</li>
          <li>It checks every {ARM_EVERY_MS / 1000} seconds, fires once, then disarms. You confirm every order and sign it yourself.</li>
          <li>Setups are rules from candles and the order book. They do not predict the market and can lose money.</li>
        </ul>
        {armed?.status === 'watching' && <Notice tone="info">{armed.display} is already armed. Arming again replaces it.</Notice>}
        <label className="flex cursor-pointer items-start gap-2.5 text-[12px] text-zinc-300"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-500" /><span>I understand this only watches and asks me to confirm, and that I place and manage any stop myself.</span></label>
        {bad && <Notice tone="warn">{bad}</Notice>}
        <Button variant="primary" className="w-full" disabled={!ack || !!bad} onClick={() => {
          arm({ pair: res.pair, display: res.display, minGrade: grade, maxUsd: maxN, equity, riskPct, expiresAt: Date.now() + Number(hours) * 3_600_000 });
          S.toast('ok', `${res.display} armed for ${hours} h. Keep this tab open.`);
          onClose();
        }}><Zap className="h-4 w-4" />Arm for {hours} h</Button>
      </div>
    </Modal>
  );
}

function ArmedCard() {
  const { armed, disarm, checking } = useArm();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(id); }, []);
  if (!armed) return null;
  const left = Math.max(0, armed.expiresAt - Date.now());
  const lh = Math.floor(left / 3_600_000), lm = Math.floor((left % 3_600_000) / 60_000);
  const tone = armed.status === 'watching' ? 'ok' : armed.status === 'ready' ? 'warn' : 'info';
  return (
    <Notice tone={tone} action={<Button size="sm" onClick={disarm}>{armed.status === 'watching' ? 'Disarm' : 'Clear'}</Button>}>
      {armed.status === 'watching' && <>Armed on <b>{armed.display}</b> ({armed.minGrade} or better, up to {usd(armed.maxUsd, 0)}). {checking ? 'Checking now…' : `Checked ${armed.checks} time${armed.checks === 1 ? '' : 's'}${armed.lastCheck ? `, last ${ageText(armed.lastCheck)} ago` : ''}.`} Expires in {lh} h {lm} min. Keep this tab open.</>}
      {armed.status === 'ready' && <>A setup on <b>{armed.display}</b> is ready. Open the review that was shown, or re-arm.</>}
      {armed.status === 'expired' && <>The armed setup on <b>{armed.display}</b> ended. Nothing was placed.</>}
    </Notice>
  );
}

function SetupBuilder({ cfg, setCfg }: { cfg: BotCfg; setCfg: (c: BotCfg) => void }) {
  const S = useS();
  const ai = useAi();
  const [pair, setPair] = useState(S.selected);
  const eq0 = S.available(QUOTE);
  const [equity, setEquity] = useState('');
  const [risk, setRisk] = useState('1');
  const [armOpen, setArmOpen] = useState(false);
  const [state, setState] = useState<{ loading: boolean; mode?: 'one' | 'best'; err?: string; res?: SetupOut; scanned?: number; failures?: { display: string; reason: string }[]; saved?: boolean }>({ loading: false });
  const gen = useRef(0);
  const eqN = parseFloat(equity || (eq0 ? String(eq0) : '')) || 0;
  const riskN = parseFloat(risk) || 0;
  const r = state.res;

  const buildPair = async (sym: Sym, shared: Awaited<ReturnType<typeof loadSetupContext>>): Promise<SetupOut> => {
    const [klines, book] = await Promise.all([fetchKlines(S.net, sym.name, '1h', 80), fetchBook(S.net, sym.name, 50)]);
    const t = S.tickers[sym.name];
    return computeSetup({
      pair: sym.name, display: sym.display, base: sym.base, candles: klines, bids: book.bids, asks: book.asks,
      last: t?.last ?? 0, quoteVol: t?.quoteVol ?? 0, takerFee: sym.taker, halted: sym.halted,
      minNotional: parseFloat(sym.minNotional) || 0, equity: eqN, riskPct: riskN, interval: '1h', builderFeePct: BUILDER_ID ? BUILDER_FEE / 1000 : 0,
      context: contextFor(sym.base, shared),
    });
  };

  const finish = (id: number, next: typeof state) => {
    if (id !== gen.current) return;
    setState(next);
    if (next.res) ai.run('setup-builder', setupExplain(next.res));
  };

  const run = async (mode: 'one' | 'best') => {
    ai.reset();
    if (!S.syms.length) { setState({ loading: false, err: 'Markets are still loading. Please try again in a moment.' }); return; }
    if (!(eqN > 0)) { setState({ loading: false, err: 'Enter an account size in USDC.' }); return; }
    if (!(riskN > 0)) { setState({ loading: false, err: 'Enter a risk percent. 1% is the usual starting point.' }); return; }
    const id = ++gen.current;
    setState({ loading: true, mode, saved: false });
    try {
      const shared = await loadSetupContext();
      if (mode === 'one') {
        const sym = S.symByName[pair] ?? S.syms.find((s) => s.name === pair);
        if (!sym) { finish(id, { loading: false, err: 'That pair is not on the live market list right now.' }); return; }
        const res = await buildPair(sym, shared);
        finish(id, { loading: false, mode, res });
        return;
      }
      const top = [...S.syms].filter((s) => !s.halted)
        .map((s) => ({ s, vol: S.tickers[s.name]?.quoteVol ?? 0 }))
        .sort((a, b) => b.vol - a.vol)
        .slice(0, 8)
        .map((x) => x.s);
      if (!top.length) { finish(id, { loading: false, err: 'No live pairs are available to scan right now.' }); return; }
      const results: SetupOut[] = [];
      const failures: { display: string; reason: string }[] = [];
      for (let i = 0; i < top.length; i += 4) {
        if (id !== gen.current) return;
        const batch = top.slice(i, i + 4);
        const part = await Promise.all(batch.map(async (s) => {
          try { return await buildPair(s, shared); }
          catch { failures.push({ display: s.display, reason: 'Live market data for this pair could not be read.' }); return null; }
        }));
        for (const out of part) {
          if (!out) continue;
          results.push(out);
          if (out.grade === 'no-trade') failures.push({ display: out.display, reason: out.reasons[0] || 'Did not meet the setup rules.' });
        }
      }
      const best = pickBest(results);
      if (!best) {
        finish(id, {
          loading: false, mode, scanned: top.length,
          failures: failures.slice(0, 8),
          err: 'No pair currently meets the rules (reward-to-risk of at least 1:2, enough book depth, a tight spread, and an up or sideways 1-hour trend).',
        });
        return;
      }
      setPair(best.pair);
      finish(id, { loading: false, mode, res: best, scanned: top.length, failures: failures.slice(0, 8) });
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : '';
      const msg = raw && !/\/api\/|ECONN|ENOENT|TypeError|stack/i.test(raw)
        ? raw
        : 'Could not read live market data right now. Please try again.';
      finish(id, { loading: false, mode, err: msg });
    }
  };

  const save = () => {
    if (!r || r.grade === 'no-trade') return;
    setCfg({
      ...cfg,
      setup: {
        on: true, pair: r.pair, entry: String(r.entry), stop: String(r.stop), tp1: String(r.tp1), tp2: String(r.tp2),
        qty: String(Number(r.qty.toPrecision(6))), notional: String(Math.round(r.notional * 100) / 100),
        riskPct: String(riskN), equity: String(eqN), grade: r.grade, rr: r.rr1.toFixed(2), trend: r.trend, at: Date.now(),
      },
    });
    setState((s) => ({ ...s, saved: true }));
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-300"><Target className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-zinc-50">AI Setup Builder</h2><span className="rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">Code first</span></div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-400">Picks a spot-buy plan from live 1-hour candles and the SoDEX order book. Gemini only explains the numbers and cannot change them. Suggestions are not financial advice, nothing runs on its own, and you sign every order.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Pair"><PairSelect value={pair || S.selected} onChange={(v) => { setPair(v); setState((s) => ({ ...s, res: undefined, err: undefined, saved: false })); ai.reset(); }} /></Field>
        <Field label="Account size" hint={eq0 ? 'your free USDC' : 'enter manually'}><AmountInput value={equity} onChange={(v) => { setEquity(v); setState((s) => ({ ...s, res: undefined, err: undefined, saved: false })); ai.reset(); }} placeholder={eq0 ? eq0.toFixed(2) : '1000'} suffix="USDC" label="Account size in USDC" /></Field>
        <Field label="Risk per trade" hint="1% is the default"><AmountInput value={risk} onChange={(v) => { setRisk(v); setState((s) => ({ ...s, res: undefined, err: undefined, saved: false })); ai.reset(); }} suffix="%" label="Risk percent" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => run('one')} loading={state.loading && state.mode === 'one'} disabled={state.loading}><Target className="h-4 w-4" />Build setup</Button>
        <Button onClick={() => run('best')} loading={state.loading && state.mode === 'best'} disabled={state.loading}><Sparkles className="h-4 w-4 text-orange-400" />Best now</Button>
      </div>
      {state.loading && <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400"><Spinner />{state.mode === 'best' ? 'Scanning the most active live pairs…' : 'Reading the live book and 1-hour candles…'}</div>}
      {state.err && !r && (
        <div className="mt-3">
          <Notice tone="info">{state.err}</Notice>
          {!!state.failures?.length && (
            <ul className="mt-2 space-y-1 text-[12px] text-zinc-500">
              {state.failures.map((f, i) => <li key={i}><span className="text-zinc-300">{f.display}:</span> {f.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      {r && (
        <div className="ss-fade mt-4 rounded-xl border border-white/[0.07] bg-black/25 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-zinc-50">{r.display}</div>
              <div className="text-[11px] text-zinc-500">1-hour candles · {r.candlesUsed} bars{state.scanned ? ` · scanned ${state.scanned} pairs` : ''}</div>
            </div>
            <span className={cx('rounded-lg border px-2.5 py-1 text-xs font-bold', SETUP_GRADE[r.grade].cls)}>{SETUP_GRADE[r.grade].label}</span>
          </div>
          <div className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <Row k="Trend" v={`${TREND_LABEL[r.trend] ?? r.trend}${r.ema20 && r.ema50 ? ` · EMA20 ${px(r.ema20)} / EMA50 ${px(r.ema50)}` : ''}`} />
            <Row k="Support / Resistance" v={`${r.support ? px(r.support) : '–'} / ${r.resistance ? px(r.resistance) : '–'}`} />
            {r.grade !== 'no-trade' && <>
              <Row k="Entry (expected fill)" v={px(r.entry)} />
              <Row k="Stop (you place it)" v={px(r.stop)} tone="bad" />
              <Row k="TP1 / TP2" v={`${px(r.tp1)} / ${px(r.tp2)}`} tone="good" />
              <Row k="R:R after fees" v={`1:${r.rr1.toFixed(2)} · 1:${r.rr2.toFixed(2)}`} />
              <Row k="Position size" v={`${Number(r.qty.toPrecision(5))} ${r.base} · ${usd(r.notional)}`} />
              <Row k="Loss if price reaches the stop" v={usd(r.maxLoss)} tone="bad" />
            </>}
            <Row k="Spread / impact" v={`${r.spreadPct.toFixed(2)}% / ${r.impactPct.toFixed(2)}%`} tone={r.spreadPct > 1 || r.impactPct > 2 ? 'bad' : r.spreadPct > 0.3 || r.impactPct > 0.5 ? 'warn' : undefined} />
            <Row k="Book coverage" v={`${r.coveragePct.toFixed(0)}%`} tone={r.coveragePct < 99.9 && r.notional > 0 ? 'bad' : undefined} />
          </div>
          {r.reasons.length > 0 && <ul className="mt-3 space-y-1 text-[13px] text-zinc-400">{r.reasons.map((x, i) => <li key={i} className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" /><span>{x}</span></li>)}</ul>}
          {r.flags.length > 0 && <FlagList flags={r.flags} />}
          {(r.newsNote || r.etfNote) && <div className="mt-3 space-y-1 rounded-lg bg-black/30 p-2.5 text-[12px] leading-relaxed text-zinc-400">{r.etfNote && <div>{r.etfNote}</div>}<div>{r.newsNote}</div></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="md" onClick={() => goToRoutePreview(S, r.pair, 'buy', String(Math.round(r.notional * 100) / 100))} disabled={r.grade === 'no-trade' || !(r.notional > 0)}>Preview route<ArrowUpRight className="h-3.5 w-3.5" /></Button>
            <Button size="md" onClick={save} disabled={r.grade === 'no-trade'}>{state.saved ? 'Saved as draft bot' : 'Save as draft bot'}</Button>
            <Button size="md" variant="primary" onClick={() => setArmOpen(true)} disabled={r.grade === 'no-trade'}><Zap className="h-3.5 w-3.5" />Arm and confirm</Button>
          </div>
          {state.saved && <p className="mt-2 text-[12px] text-emerald-300">Saved as a draft bot below. It will not place any order.</p>}
          {r.grade !== 'no-trade' && <p className="mt-2 text-[12px] leading-relaxed text-amber-300/90">SoSwapDEX cannot place a stop-loss on the exchange. The stop above is a price you must watch or alert on. If price gaps past it, you lose more than the number shown.</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Suggestions are not financial advice. SoSwapDEX does not place this order or a stop for you. Preview the route and sign in your own wallet if you decide to trade.</p>
        </div>
      )}
      <AiBox ai={ai} />
      {r && r.grade !== 'no-trade' && <ArmModal open={armOpen} onClose={() => setArmOpen(false)} res={r} equity={eqN} riskPct={riskN} />}
    </Card>
  );
}

function BotsView() {
  const S = useS();
  const [cfg, setCfgState] = useState<BotCfg>(BOT_DEFAULT);
  const [edit, setEdit] = useState<BotKind | null>(null);
  useEffect(() => { const v = lsGet<Partial<BotCfg>>(BOT_LS, {}); setCfgState({ dca: { ...BOT_DEFAULT.dca, ...v.dca }, grid: { ...BOT_DEFAULT.grid, ...v.grid }, signal: { ...BOT_DEFAULT.signal, ...v.signal }, setup: { ...BOT_DEFAULT.setup, ...v.setup } }); }, []);
  const setCfg = (c: BotCfg) => { setCfgState(c); lsSet(BOT_LS, c); };
  const bots: { kind: BotKind; name: string; desc: string; icon: React.ReactNode }[] = [
    ...(cfg.setup.at ? [{ kind: 'setup' as const, name: 'AI Setup Bot', desc: 'Saved spot-buy levels from the builder above. Draft only.', icon: <span className="grid h-14 w-14 place-items-center rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300"><Target className="h-6 w-6" /></span> }] : []),
    { kind: 'dca', name: 'DCA Bot', desc: 'Buy at intervals (e.g., daily/weekly).', icon: <AnimalOrb kind="dog" size={54} compact still /> },
    { kind: 'grid', name: 'Grid Bot', desc: 'Trade in a price range.', icon: <AnimalOrb kind="owl" size={54} compact still /> },
    { kind: 'signal', name: 'Signal Bot', desc: 'Act on market signals (e.g., ETF/news).', icon: <AnimalOrb kind="bull" size={54} compact still /> },
  ];
  return (
    <div className="mx-auto max-w-[900px]">
      <PageTitle icon={<Bot className="h-8 w-8" />} title="Bots (Drafts)" sub="Build a code-checked spot-buy setup, or draft a DCA, grid or signal plan. Nothing runs unattended."
        right={<span className="rounded-lg border border-indigo-400/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-200">Draft Mode</span>} />
      <ArmedCard />
      <SetupBuilder cfg={cfg} setCfg={setCfg} />
      <div className="mt-4 space-y-3">
        {bots.map((b, bi) => {
          const c = cfg[b.kind];
          const sym = S.symByName[c.pair || S.selected] ?? S.syms[0];
          const price = sym ? S.tickers[sym.name]?.last ?? 0 : 0;
          return (
            <AnimatedCard key={b.kind} delay={0.08 * bi} className="rounded-2xl border border-orange-500/20 bg-white/[0.03] p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center">{b.icon}</div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-base font-bold text-zinc-50">{b.name}</span><span className="rounded-md bg-indigo-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200">Draft</span></div><p className="text-[13px] text-zinc-400">{b.desc}</p></div>
                <Button size="sm" className="hidden sm:inline-flex" onClick={() => setEdit(b.kind)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                <button aria-label={`Edit ${b.name}`} onClick={() => setEdit(b.kind)} className="p-2 text-zinc-400 sm:hidden"><Pencil className="h-4 w-4" /></button>
                <button role="switch" aria-checked={c.on} aria-label={`Show ${b.name} preview`} onClick={() => setCfg({ ...cfg, [b.kind]: { ...c, on: !c.on } } as BotCfg)}
                  className={cx('relative h-6 w-11 shrink-0 rounded-full border transition', c.on ? 'border-orange-500 bg-orange-500' : 'border-white/15 bg-white/[0.06]')}>
                  <span className={cx('absolute top-0.5 h-4.5 w-[18px] rounded-full bg-white transition-all', c.on ? 'left-[22px]' : 'left-0.5')} style={{ height: 18 }} />
                </button>
              </div>
              {c.on && <BotPreview kind={b.kind} cfg={cfg} sym={sym} price={price} />}
            </AnimatedCard>
          );
        })}
      </div>
      <div className="mt-4"><Notice tone="warn"><b>Drafts only.</b> No orders are sent automatically. Order sending stays off until it is turned on, because it uses real funds. The switches above only show a preview.</Notice></div>
      {edit && <BotEditor kind={edit} cfg={cfg} setCfg={setCfg} onClose={() => setEdit(null)} />}
    </div>
  );
}

/* ───────── guide ───────── */

const GUIDE: { id: string; icon: React.ReactNode; title: string; sub: string; body: React.ReactNode }[] = [
  { id: 'overview', icon: <Home className="h-4 w-4" />, title: 'Overview', sub: 'A quick guide to SoSwapDEX and what it can do.', body: null },
  { id: 'connect', icon: <Wallet className="h-4 w-4" />, title: 'Connect Wallet', sub: 'Use your own Web3 wallet (e.g., MetaMask, Rabby, OKX).', body: <>Press <b>Connect Wallet</b> and pick a browser wallet. Connecting shares only your address. To trade, you need a SoDEX account (deposit on sodex.com). Then choose <b>Enable trading</b>: one wallet signature registers a session API key that lives only in this browser tab and signs your orders.</> },
  { id: 'swap', icon: <ArrowDownUp className="h-4 w-4" />, title: 'How to Swap', sub: 'Choose a pair, review the route, and sign the transaction.', body: <>Pick the <b>From</b> and <b>To</b> tokens and an amount. Every pair on SoDEX is quoted in USDC, so a swap between two other tokens is two market orders routed through USDC. Review the summary, confirm, and watch the fills.</> },
  { id: 'route', icon: <Star className="h-4 w-4" />, title: 'Route Preview', sub: 'See the live route and estimate before you sign.', body: <>The Route Preview walks the live SoDEX order book to estimate what you receive, the price impact and the taker fee. It is an estimate: the book can move before your order fills, so a minimum-received limit based on your slippage setting protects each order.</> },
  { id: 'markets', icon: <BarChart3 className="h-4 w-4" />, title: 'Markets & Insights', sub: 'Get SoSoValue news, ETF flows, and sector moves.', body: <>Markets lists every SoDEX spot pair with live price, 24h change and volume. News, ETF flows and sectors come from SoSoValue and need a free API key (paste it in the panel). If a feed is down or no key is set you see an empty state, never sample numbers.</> },
  { id: 'cross', icon: <Link2 className="h-4 w-4" />, title: 'Cross-Chain', sub: 'Add funds from another chain, or withdraw to one.', body: <>Add funds finds a route that lands a SoDEX-supported token in your own wallet. You sign every step. Deposit and withdrawal still happen on sodex.com — SoSwapDEX never holds funds or deposits for you. Route quotes are estimates: fees and time can change. A deposit below the official minimum, or on an unsupported token or chain, can be lost or not credited.</> },
  { id: 'bots', icon: <Bot className="h-4 w-4" />, title: 'Bots (Drafts)', sub: 'Create trading strategies. Draft only. Nothing runs unattended.', body: <>The AI Setup Builder computes a spot-buy plan from live 1-hour candles and the order book (trend, stop, targets and size). Gemini only explains those numbers and cannot change them. You can also arm a setup: while the tab is open it re-checks every 45 seconds and asks you to confirm when your minimum grade is met. It never places an order by itself, and no stop-loss is placed on the exchange. DCA, Grid and Signal bots are also drafts: they compute a dry-run preview from live prices and never send orders. Nothing runs in the background, and a closed tab means nothing happens.</> },
  { id: 'safety', icon: <ShieldCheck className="h-4 w-4" />, title: 'Safety & FAQs', sub: 'How SoSwapDEX handles your keys and funds.', body: <><ul className="list-disc space-y-1.5 pl-5"><li>SoSwapDEX never holds your funds and never asks for a seed phrase.</li><li>The session API key is a hot key kept in this tab (sessionStorage). Its permissions are set by SoDEX; fund only what you intend to trade and revoke keys on sodex.com/apikeys.</li><li>{DISCLAIMER}</li></ul></> },
];

const GUIDE_VIDEO = 'https://www.youtube-nocookie.com/embed/uuOAIz47hjU';

function GuideVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Watch the guide" maxW="sm:max-w-3xl">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {open && (
          <iframe
            src={GUIDE_VIDEO}
            title="SoSwapDEX guide demo"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </Modal>
  );
}

function GuideView() {
  const [sec, setSec] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [watch, setWatch] = useState(false);
  const cur = GUIDE.find((g) => g.id === sec)!;
  const flow = [{ i: <Wallet className="h-5 w-5" />, a: 'Connect', b: 'Wallet' }, { i: <ArrowDownUp className="h-5 w-5" />, a: 'Swap', b: '(Preview & Sign)' }, { i: <BarChart3 className="h-5 w-5" />, a: 'Markets', b: '(News & ETF Flows)' }, { i: <Link2 className="h-5 w-5" />, a: 'Cross-Chain', b: '(Add funds)' }, { i: <Bot className="h-5 w-5" />, a: 'Bots', b: '(Drafts)' }];
  const checks = ['Uses real SoDEX mainnet markets and routes', 'Shows a clear preview before you sign', 'Integrates SoSoValue news, ETF flows, and sector data', 'Cross-chain routes land tokens in your wallet; deposits and withdrawals stay on SoDEX', 'Bots are draft only (no unattended trading), and the AI Setup Builder never places an order', 'If a feed is down, you see an empty state (not sample prices)'];
  const detail = sec === 'overview' ? (
    <>
      <div className="my-4 flex flex-wrap items-start justify-between gap-2">
        {flow.map((f, i) => <React.Fragment key={f.a}><div className="w-[88px] text-center"><div className="mx-auto mb-1 grid h-10 w-10 place-items-center text-orange-400">{f.i}</div><div className="text-[11px] font-semibold text-zinc-200">{f.a}</div><div className="text-[10px] leading-tight text-zinc-500">{f.b}</div></div>{i < flow.length - 1 && <ChevronRight className="mt-3 h-4 w-4 text-orange-500" />}</React.Fragment>)}
      </div>
      <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-3 text-[13px] text-zinc-200"><Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />SoSwapDEX is a SoDEX mainnet swap. You connect your own wallet, see live markets and a route preview, and sign every order yourself.</div>
      <ul className="space-y-2.5">{checks.map((c) => <li key={c} className="flex items-start gap-2.5 text-[13px] text-zinc-200"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-black"><Check className="h-3 w-3" strokeWidth={3} /></span>{c}</li>)}</ul>
    </>
  ) : <div className="mt-3 text-[13px] leading-relaxed text-zinc-300">{cur.body}</div>;
  const steps = GUIDE.slice(1, 7).filter((g) => g.id !== 'safety');

  return (
    <div className="mx-auto max-w-[980px]">
      <PageTitle icon={<BookOpen className="h-8 w-8" />} title="Guide" sub="Learn how to use SoSwapDEX safely on SoDEX mainnet." right={<Button variant="primary" onClick={() => setWatch(true)} className="shrink-0"><Play className="h-3.5 w-3.5 fill-current" />Watch the guide</Button>} />
      <GuideVideoModal open={watch} onClose={() => setWatch(false)} />
      {/* mobile: numbered step cards (tap to open) */}
      <div className="md:hidden">
        {!mobileOpen ? (
          <div className="space-y-2.5">
            {steps.map((g, i) => (
              <button key={g.id} onClick={() => { setSec(g.id); setMobileOpen(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-left">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-400">{g.icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-zinc-50">{i + 1}  {g.title}</span><span className="block text-[11px] text-zinc-400">{g.sub}</span></span>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </button>
            ))}
            <button onClick={() => { setSec('safety'); setMobileOpen(true); }} className="flex w-full items-center gap-2 rounded-2xl border border-white/[0.08] p-3 text-sm font-semibold text-zinc-200"><ShieldCheck className="h-4 w-4 text-orange-400" />Safety & FAQs</button>
          </div>
        ) : (
          <Card className="p-4"><button onClick={() => setMobileOpen(false)} className="mb-2 text-xs text-orange-400">← All topics</button><h2 className="text-lg font-bold text-zinc-50">{cur.title}</h2><p className="text-xs text-zinc-400">{cur.sub}</p>{detail}</Card>
        )}
      </div>
      {/* desktop: menu + content */}
      <div className="hidden gap-4 md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Guide sections" className="space-y-1 rounded-2xl border border-orange-500/20 bg-black/40 p-2">
          {GUIDE.map((g) => <button key={g.id} onClick={() => setSec(g.id)} className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition', sec === g.id ? 'bg-gradient-to-b from-orange-400 to-orange-500 text-black' : 'text-zinc-300 hover:bg-white/[0.05]')}>{g.icon}{g.title}</button>)}
        </nav>
        <AnimatedTabs activeKey={sec}><Card className="p-5 !border-orange-500/20"><h2 className="text-xl font-bold text-zinc-50">{cur.title}</h2><p className="text-[13px] text-zinc-400">{cur.sub}</p>{detail}</Card></AnimatedTabs>
      </div>
    </div>
  );
}

/* ═════════════════════════ skills: code-checked risk tools + Gemini explanations ═════════════════════════ */

type AiOut = { headline: string; summary: string; points: string[]; watch: string[] };
function useAi() {
  const [st, setSt] = useState<{ status: 'idle' | 'loading' | 'ok' | 'err'; out?: AiOut; err?: string }>({ status: 'idle' });
  const run = useCallback(async (skill: string, data?: unknown, note?: string) => {
    setSt({ status: 'loading' });
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 35_000);
    try {
      const r = await fetch('/api/skills', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skill, data, note }), signal: ctl.signal });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.error) throw new Error(j?.error || `The AI service returned ${r.status}.`);
      setSt({ status: 'ok', out: j as AiOut });
    } catch (e: any) {
      setSt({ status: 'err', err: e?.name === 'AbortError' ? 'The AI took too long. Please try again.' : String(e?.message || 'Could not reach the AI service.') });
    } finally { clearTimeout(t); }
  }, []);
  return { ...st, run, reset: () => setSt({ status: 'idle' }) };
}

function AiBox({ ai }: { ai: ReturnType<typeof useAi> }) {
  if (ai.status === 'idle') return null;
  if (ai.status === 'loading') return <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/30 p-3 text-xs text-zinc-400"><Spinner />Gemini is reading the numbers…</div>;
  if (ai.status === 'err') return <div className="mt-3"><Notice tone="error">{ai.err}</Notice></div>;
  const o = ai.out!;
  return (
    <div className="ss-fade mt-3 rounded-xl border border-orange-500/25 bg-orange-500/[0.05] p-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-orange-300"><Sparkles className="h-3 w-3" />Explained by Gemini</div>
      <div className="text-sm font-semibold text-zinc-50">{o.headline}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">{o.summary}</p>
      {o.points.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-zinc-300">{o.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
      {o.watch.length > 0 && <div className="mt-2.5 rounded-lg bg-black/30 p-2.5 text-[12px] text-zinc-400"><b className="text-zinc-200">Double-check: </b>{o.watch.join(' · ')}</div>}
      <p className="mt-2 text-[10px] text-zinc-500">AI can be wrong and is not financial advice. It only explains the data above and cannot trade for you.</p>
    </div>
  );
}

const GRADE: Record<Grade, { label: string; cls: string }> = {
  safe: { label: 'Looks OK', cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' },
  caution: { label: 'Caution', cls: 'border-orange-500/40 bg-orange-500/15 text-orange-300' },
  avoid: { label: 'High risk', cls: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
};
const GradeBadge = ({ g }: { g: Grade }) => <span className={cx('rounded-lg border px-2.5 py-1 text-xs font-bold', GRADE[g].cls)}>{GRADE[g].label}</span>;
const FlagList = ({ flags }: { flags: Flag[] }) => (
  <ul className="mt-3 space-y-1.5">
    {flags.map((f, i) => (
      <li key={i} className={cx('flex items-start gap-2 text-[13px]', f.sev === 'bad' ? 'text-rose-300' : f.sev === 'warn' ? 'text-orange-300' : 'text-zinc-400')}>
        {f.sev === 'info' ? <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span>{f.text}</span>
      </li>
    ))}
  </ul>
);
const selCls = 'h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-orange-500/60';
const AiButton = ({ ai, onClick, label = 'Explain with AI', disabled }: { ai: ReturnType<typeof useAi>; onClick: () => void; label?: string; disabled?: boolean }) => (
  <Button onClick={onClick} loading={ai.status === 'loading'} disabled={disabled}><Sparkles className="h-3.5 w-3.5 text-orange-400" />{label}</Button>
);

function PairSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const S = useS();
  return (
    <select aria-label="Pair" value={value} onChange={(e) => onChange(e.target.value)} className={selCls}>
      {S.syms.filter((s) => !s.halted).map((s) => <option key={s.name} value={s.name}>{s.display}</option>)}
    </select>
  );
}

function TradeCheck() {
  const S = useS();
  const [pair, setPair] = useState(() => { const p = skillIntent.pair || S.selected; skillIntent.pair = undefined; return p; });
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [usdIn, setUsdIn] = useState('100');
  const [state, setState] = useState<{ loading: boolean; err?: string; res?: ScanOut; at?: number }>({ loading: false });
  const ai = useAi();
  const sym = S.symByName[pair];
  const usdN = parseFloat(usdIn) || 0;
  const scan = async () => {
    if (!sym) { setState({ loading: false, err: 'Markets are still loading. Please try again in a moment.' }); return; }
    if (usdN <= 0) { setState({ loading: false, err: 'Enter an amount in USDC.' }); return; }
    ai.reset(); setState({ loading: true });
    try {
      // book and (only if missing) the ticker load in parallel; both retry once on their own
      const [b, t] = await Promise.all([
        fetchBook(S.net, pair, 50),
        S.tickers[pair] ? Promise.resolve(S.tickers[pair]) : fetchTickers(S.net).then((all) => all[pair]),
      ]);
      if (!t) throw new Error('No live price for this pair right now. Please try again.');
      setState({ loading: false, at: Date.now(), res: scanTrade({ side, usd: usdN, bids: b.bids, asks: b.asks, open: t.open, high: t.high, low: t.low, last: t.last, quoteVol: t.quoteVol, takerFee: sym.taker, halted: sym.halted }) });
    } catch (e: any) { setState({ loading: false, err: String(e?.message || 'Could not read the order book.') }); }
  };
  const r = state.res;
  useEffect(() => {
    const el = document.getElementById('trade-check-actions');
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }, []);
  return (
    <Card className="p-4">
      <p className="mb-3 text-[13px] text-zinc-400"><span className="sm:hidden">Flags thin books, wide spreads and price impact <b className="text-zinc-200">before</b> you sign.</span><span className="hidden sm:inline">Walks the live order book for your exact size and flags thin liquidity, wide spreads, price impact and volatility <b className="text-zinc-200">before</b> you trade. This is the most common way people lose money without noticing.</span></p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Pair"><PairSelect value={pair} onChange={(v) => { setPair(v); setState({ loading: false }); ai.reset(); }} /></Field>
        <Field label="Side"><Segmented value={side} onChange={(v) => { setSide(v); setState({ loading: false }); ai.reset(); }} options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} /></Field>
        <Field label="Order size"><AmountInput value={usdIn} onChange={(v) => { setUsdIn(v); setState({ loading: false }); ai.reset(); }} suffix="USDC" label="Order size in USDC" /></Field>
      </div>
      <div id="trade-check-actions" className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={scan} loading={state.loading}><ShieldCheck className="h-4 w-4" />Scan this trade</Button>
        <Button size="md" onClick={() => goToRoutePreview(S, pair, side, usdIn)}>Preview route<ArrowUpRight className="h-3.5 w-3.5" /></Button>
        {r && <AiButton ai={ai} onClick={() => ai.run('trade-check', { pair: sym?.display, side, sizeUsdc: usdN, grade: r.grade, spreadPct: +r.spreadPct.toFixed(3), priceImpactPct: +r.impactPct.toFixed(3), depthCoveragePct: +r.coveragePct.toFixed(0), range24hPct: +r.rangePct.toFixed(2), shareOf24hVolumePct: +r.volShare.toFixed(3), roundTripCostPct: +r.roundTripCostPct.toFixed(2), warnings: r.flags.map((f) => f.text) })} />}
      </div>
      {state.err && <div className="mt-3 space-y-2"><Notice tone="error">{state.err}</Notice><Button size="sm" onClick={scan} loading={state.loading}>Retry</Button></div>}
      {r && (
        <div className="ss-fade mt-4 rounded-xl border border-white/[0.07] bg-black/25 p-3.5">
          <div className="mb-3 flex items-center justify-between"><GradeBadge g={r.grade} /><span className="text-[10px] text-zinc-500">book snapshot {new Date(state.at!).toLocaleTimeString()}</span></div>
          <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <Row k="Spread" v={`${r.spreadPct.toFixed(3)}%`} /><Row k="Price impact at your size" v={`${r.impactPct.toFixed(3)}%`} tone={r.impactPct > 0.5 ? 'warn' : undefined} />
            <Row k="Depth covers your size" v={`${r.coveragePct.toFixed(0)}%`} tone={r.coveragePct < 100 ? 'bad' : undefined} /><Row k="24h range" v={`${r.rangePct.toFixed(1)}%`} />
            <Row k="Your size vs 24h volume" v={`${r.volShare.toFixed(3)}%`} /><Row k="Est. in+out cost" v={`${r.roundTripCostPct.toFixed(2)}%`} tone={r.roundTripCostPct > 1.5 ? 'warn' : undefined} />
          </div>
          <FlagList flags={r.flags} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => goToRoutePreview(S, pair, side, usdIn)}>Preview route<ArrowUpRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
      <AiBox ai={ai} />
    </Card>
  );
}

function SizeCheck() {
  const S = useS();
  const [pair, setPair] = useState(S.selected);
  const eq0 = S.available(QUOTE);
  const [equity, setEquity] = useState('');
  const [risk, setRisk] = useState('1');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const ai = useAi();
  const last = S.tickers[pair]?.last ?? 0;
  const eqN = parseFloat(equity || String(eq0 || 0)) || 0, riskN = parseFloat(risk) || 0, entryN = parseFloat(entry || String(last)) || 0, stopN = parseFloat(stop) || 0;
  const sym = S.symByName[pair];
  const res = useMemo(() => sizePosition({ equity: eqN, riskPct: riskN, entry: entryN, stop: stopN, feePct: (sym?.taker ?? 0) * 100 }), [eqN, riskN, entryN, stopN, sym]);
  return (
    <Card className="p-4">
      <p className="mb-3 text-[13px] text-zinc-400">Decide the most you are willing to lose <b className="text-zinc-200">first</b>, and this works out the size. Pros typically risk 1–2% of their account per trade, so a bad streak cannot wipe them out.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pair"><PairSelect value={pair} onChange={(v) => { setPair(v); setEntry(''); ai.reset(); }} /></Field>
        <Field label="Account size" hint={eq0 ? 'your free USDC' : 'enter manually'}><AmountInput value={equity} onChange={setEquity} placeholder={eq0 ? eq0.toFixed(2) : '1000'} suffix="USDC" label="Account size in USDC" /></Field>
        <Field label="Risk per trade" hint="1–2% is typical"><AmountInput value={risk} onChange={setRisk} suffix="%" label="Risk percent" /></Field>
        <Field label="Entry price"><AmountInput value={entry} onChange={setEntry} placeholder={last ? String(last) : '0'} label="Entry price" /></Field>
        <Field label="Stop price" hint="where you admit you were wrong"><AmountInput value={stop} onChange={setStop} placeholder="0" label="Stop price" /></Field>
      </div>
      {res ? (
        <div className="ss-fade mt-4 rounded-xl border border-white/[0.07] bg-black/25 p-3.5">
          <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <Row k="Max loss if stop hits" v={usd(res.maxLoss)} tone="bad" /><Row k="Position size" v={`${res.qty.toPrecision(5)} ${sym?.base ?? ''}`} />
            <Row k="Position value" v={`${usd(res.notional)} (${res.notionalPctOfEquity.toFixed(0)}% of account)`} tone={res.notionalPctOfEquity > 100 ? 'bad' : undefined} /><Row k="Stop distance" v={`${res.stopDistPct.toFixed(2)}%`} />
          </div>
          {res.flags.length > 0 && <FlagList flags={res.flags} />}
          <p className="mt-3 text-[11px] text-zinc-500">A stop does not guarantee your exit price: in a fast market a market order can fill beyond it. SoSwapDEX does not place stop orders for you.</p>
          <div className="mt-3"><AiButton ai={ai} onClick={() => ai.run('size-check', { pair: sym?.display, accountUsdc: eqN, riskPct: riskN, entry: entryN, stop: stopN, maxLossUsdc: +res.maxLoss.toFixed(2), positionValueUsdc: +res.notional.toFixed(2), positionPctOfAccount: +res.notionalPctOfEquity.toFixed(1), warnings: res.flags.map((f) => f.text) })} /></div>
        </div>
      ) : <div className="mt-4"><Notice tone="info">Enter an account size, a risk %, an entry and a different stop price to see your position size.</Notice></div>}
      <AiBox ai={ai} />
    </Card>
  );
}

function PortfolioCheck() {
  const S = useS();
  const ai = useAi();
  const res = useMemo(() => portfolioHealth(S.balances.map((b) => ({ coin: coinLabel(b.coin), usd: b.total * S.priceOf(b.coin) }))), [S.balances, S.priceOf]);
  if (!S.wallet) return <Card><Empty icon={<Wallet className="h-6 w-6" />} title="Connect a wallet to check your portfolio" body="Concentration is calculated in your browser from your SoDEX balances." action={<Button variant="primary" onClick={() => S.setUi('connect', true)}>Connect wallet</Button>} /></Card>;
  if (!res) return <Card><Empty icon={<Coins className="h-6 w-6" />} title="No balances to check" body="Deposit on SoDEX first, then come back." /></Card>;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between"><div><div className="text-xs text-zinc-500">Total value</div><div className="tnum text-xl font-bold text-zinc-50">{usd(res.total)}</div></div><GradeBadge g={res.grade} /></div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label="Portfolio weights">
        {res.weights.map((w, i) => <div key={w.coin} title={`${w.coin} ${w.pct.toFixed(1)}%`} style={{ width: `${w.pct}%`, opacity: 1 - Math.min(i, 6) * 0.12 }} className="bg-orange-500" />)}
      </div>
      <div className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">{res.weights.slice(0, 8).map((w) => <Row key={w.coin} k={w.coin} v={`${w.pct.toFixed(1)}% · ${usd(w.usd)}`} />)}</div>
      <FlagList flags={res.flags} />
      <div className="mt-3"><AiButton ai={ai} onClick={() => ai.run('portfolio-health', { totalUsd: Math.round(res.total), stablecoinPct: +res.stablePct.toFixed(1), holdings: res.weights.slice(0, 8).map((w) => ({ coin: w.coin, pct: +w.pct.toFixed(1) })), grade: res.grade, warnings: res.flags.map((f) => f.text) })} /></div>
      <AiBox ai={ai} />
    </Card>
  );
}

function JournalCard() {
  const S = useS();
  const ai = useAi();
  const [st, setSt] = useState<{ loading: boolean; err?: string; n?: number; res?: ReturnType<typeof journalStats> }>({ loading: false });
  const load = useCallback(async () => {
    if (!S.wallet) return;
    setSt({ loading: true }); ai.reset();
    try {
      const fills = await fetchFills(S.net, S.wallet.address, { limit: 100, aid: S.accountID ?? undefined });
      setSt({ loading: false, n: fills.length, res: journalStats(fills, [QUOTE, 'USDC']) });
    } catch (e: any) { setSt({ loading: false, err: String(e?.message || 'Could not load your fills.') }); }
  }, [S.wallet, S.net, S.accountID]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  if (!S.wallet) return <Card><Empty icon={<Wallet className="h-6 w-6" />} title="Connect a wallet to see your journal" body="Your fills are read from SoDEX for your address. Nothing is stored by SoSwapDEX." action={<Button variant="primary" onClick={() => S.setUi('connect', true)}>Connect wallet</Button>} /></Card>;
  const r = st.res;
  return (
    <Card className="p-4">
      {st.loading && <div className="flex items-center gap-2 text-sm text-zinc-400"><Spinner />Loading your fills…</div>}
      {st.err && <Notice tone="error">{st.err}</Notice>}
      {r && r.trades === 0 && <Empty icon={<Coins className="h-6 w-6" />} title="No fills yet" body="Once you trade on SoDEX, your results show up here." />}
      {r && r.trades > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Fills', String(r.trades)], ['Volume', usd(r.vol, 0)], ['Fees paid', usd(r.fees, 2)], ['Realised P&L', usd(r.pnl, 2)]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/[0.07] bg-black/25 p-3"><div className="text-[11px] text-zinc-500">{k}</div><div className={cx('tnum mt-0.5 text-lg font-bold', k === 'Realised P&L' ? (r.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300') : 'text-zinc-50')}>{v}</div></div>
            ))}
          </div>
          <div className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            <Row k="Winning / losing sells" v={`${r.wins} / ${r.losses}`} /><Row k="Maker share" v={`${r.makerPct.toFixed(0)}%`} />
          </div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="text-left text-[11px] text-zinc-500"><th className="py-1.5 pr-3 font-medium">Pair</th><th className="pr-3 text-right font-medium">Volume</th><th className="pr-3 text-right font-medium">Fees</th><th className="text-right font-medium">Realised P&L</th></tr></thead>
            <tbody>{r.rows.slice(0, 8).map((x) => <tr key={x.symbol} className="border-t border-white/[0.05]"><td className="py-1.5 pr-3 text-zinc-200">{S.symByName[x.symbol]?.display ?? x.symbol}</td><td className="tnum pr-3 text-right text-zinc-300">{usd(x.vol, 0)}</td><td className="tnum pr-3 text-right text-zinc-400">{usd(x.fees, 2)}</td><td className={cx('tnum text-right', x.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{usd(x.pnl, 2)}</td></tr>)}</tbody></table></div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Based on your latest {st.n} fills only, using first-in-first-out cost. Sells of coins bought before this window have no known cost and are left out of P&L, and unrealised gains are not counted. Fees in a non-quote coin are converted at the fill price.</p>
          <div className="mt-3 flex gap-2"><Button size="sm" onClick={load} loading={st.loading}>Refresh</Button><AiButton ai={ai} onClick={() => ai.run('journal-review', { fills: r.trades, volumeUsd: Math.round(r.vol), feesUsd: +r.fees.toFixed(2), realisedPnlUsd: +r.pnl.toFixed(2), winningSells: r.wins, losingSells: r.losses, makerPct: +r.makerPct.toFixed(0), pairs: r.rows.slice(0, 6).map((x) => ({ pair: S.symByName[x.symbol]?.display ?? x.symbol, volumeUsd: Math.round(x.vol), feesUsd: +x.fees.toFixed(2), pnlUsd: +x.pnl.toFixed(2) })) })} /></div>
        </>
      )}
      <AiBox ai={ai} />
    </Card>
  );
}

type PriceAlert = { id: string; symbol: string; dir: 'above' | 'below'; price: number; created: number; firedAt?: number };
const ALERTS_KEY = 'soswap.alerts.v1';

/** Watches the tickers the app already polls and notifies when a pair crosses a price. Only runs while SoSwapDEX is open. */
function useAlerts() {
  const S = useS();
  const [list, setList] = useState<PriceAlert[]>([]);
  const loaded = useRef(false);
  useEffect(() => { setList(lsGet<PriceAlert[]>(ALERTS_KEY, [])); loaded.current = true; }, []);
  useEffect(() => { if (loaded.current) lsSet(ALERTS_KEY, list.slice(0, 40)); }, [list]);
  useEffect(() => {
    if (!list.some((a) => !a.firedAt)) return;
    const hit = list.filter((a) => { const t = S.tickers[a.symbol]; return !a.firedAt && t && (a.dir === 'above' ? t.last >= a.price : t.last <= a.price); });
    if (!hit.length) return;
    setList((l) => l.map((a) => (hit.some((h) => h.id === a.id) ? { ...a, firedAt: Date.now() } : a)));
    for (const a of hit) {
      const d = S.symByName[a.symbol]?.display ?? a.symbol;
      const text = `${d} is ${a.dir === 'above' ? 'at or above' : 'at or below'} ${a.price}`;
      S.toast('info', text);
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('SoSwapDEX price alert', { body: text, icon: '/icons/icon-192.png' }); } catch { /* ignore */ }
    }
  }, [S.tickers]); // eslint-disable-line react-hooks/exhaustive-deps
  return { list, add: (a: Omit<PriceAlert, 'id' | 'created'>) => setList((l) => [{ ...a, id: Math.random().toString(36).slice(2, 10), created: Date.now() }, ...l]), remove: (id: string) => setList((l) => l.filter((x) => x.id !== id)) };
}

const AlertsCtx = createContext<ReturnType<typeof useAlerts> | null>(null);
/** Mounted once at app level so alerts keep firing on every tab, not only while the Alerts card is open. */
function AlertsHost({ children }: { children: React.ReactNode }) {
  const a = useAlerts();
  return <AlertsCtx.Provider value={a}>{children}</AlertsCtx.Provider>;
}

function AlertsCard() {
  const S = useS();
  const { list, add, remove } = useContext(AlertsCtx)!;
  const [pair, setPair] = useState(S.selected);
  const [dir, setDir] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [perm, setPerm] = useState<string>('default');
  useEffect(() => { try { setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission); } catch { setPerm('unsupported'); } }, []);
  const last = S.tickers[pair]?.last ?? 0;
  const p = parseFloat(price) || 0;
  const ask = async () => { try { setPerm(await Notification.requestPermission()); } catch { /* ignore */ } };
  return (
    <Card className="p-4">
      <p className="mb-3 text-[13px] text-zinc-400">Set a price and walk away from the screen. Alerts help you avoid chasing a move: decide your level first, then act when it arrives.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Pair"><PairSelect value={pair} onChange={(v) => { setPair(v); setPrice(''); }} /></Field>
        <Field label="When the price is"><Segmented value={dir} onChange={setDir} options={[{ value: 'above', label: 'At or above' }, { value: 'below', label: 'At or below' }]} /></Field>
        <Field label="Price" hint={last ? `now ${last}` : undefined}><AmountInput value={price} onChange={setPrice} placeholder={last ? String(last) : '0'} suffix="USDC" label="Alert price" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!(p > 0)} onClick={() => { add({ symbol: pair, dir, price: p }); setPrice(''); S.toast('ok', 'Alert added.'); }}>Add alert</Button>
        {perm === 'default' && <Button onClick={ask}>Allow notifications</Button>}
      </div>
      {perm === 'denied' && <div className="mt-3"><Notice tone="warn">Notifications are blocked in this browser. You will still see an alert inside SoSwapDEX while it is open.</Notice></div>}
      <p className="mt-3 text-[11px] text-zinc-500">Alerts are saved on this device and only checked while SoSwapDEX is open in a tab or the installed app. They do not run in the background.</p>
      {list.length === 0 ? <div className="mt-3"><Notice tone="info">No alerts yet. Pick a pair and a price above.</Notice></div> : (
        <ul className="mt-3 divide-y divide-white/[0.05]">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <span className="min-w-0 text-zinc-200">{S.symByName[a.symbol]?.display ?? a.symbol} <span className="text-zinc-500">{a.dir === 'above' ? 'at or above' : 'at or below'}</span> <span className="tnum">{a.price}</span></span>
              <span className="flex items-center gap-2">
                {a.firedAt ? <Badge tone="emerald">Triggered</Badge> : <Badge tone="zinc">Watching</Badge>}
                <button onClick={() => remove(a.id)} aria-label="Delete alert" className="rounded-md p-1 text-zinc-500 hover:text-rose-300"><X className="h-4 w-4" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BriefCard({ skill, title, body, cta }: { skill: string; title: string; body: string; cta: string }) {
  const ai = useAi();
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-[13px] text-zinc-400">{body}</p>
      <div className="mt-3"><AiButton ai={ai} label={cta} onClick={() => ai.run(skill)} /></div>
      <AiBox ai={ai} />
    </Card>
  );
}

function PlanReview() {
  const S = useS();
  const [note, setNote] = useState('');
  const [pair, setPair] = useState(S.selected);
  const ai = useAi();
  return (
    <Card className="p-4">
      <p className="mb-3 text-[13px] text-zinc-400">Write your plan in your own words (why you want this trade, size, where you would stop, when you would take profit). The AI reviews it like a risk manager and lists what is missing. It will not approve or reject the trade.</p>
      <div className="grid gap-3"><Field label="Pair"><PairSelect value={pair} onChange={setPair} /></Field>
        <Field label="Your plan" hint={`${note.length}/1500`}>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1500))} rows={5} placeholder="e.g. Buy $200 because it dipped 10% today. Not sure about the exit…" className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-orange-500/60" />
        </Field></div>
      <div className="mt-3"><AiButton ai={ai} label="Review my plan" disabled={note.trim().length < 10} onClick={() => ai.run('plan-review', { pair: S.symByName[pair]?.display, last: S.tickers[pair]?.last, change24hPct: S.tickers[pair]?.changePct }, note)} /></div>
      <AiBox ai={ai} />
    </Card>
  );
}

/** Lets other screens open Skills on a given tab (e.g. the Home watchlist bell). */
const skillIntent: { tab: SkillTab | null; pair?: string } = { tab: null };
/** One-shot handoff from Trade Check to Swap so Route Preview opens on the same pair and size. */
const swapIntent: { pair?: string; side?: 'buy' | 'sell'; usd?: string; focus?: boolean } = {};
type SkillTab = 'trade' | 'size' | 'portfolio' | 'journal' | 'alerts' | 'brief' | 'news' | 'plan' | 'fund' | 'withdraw' | 'routecheck';

function goToTradeCheck(S: Store, pair: string) {
  S.setSelected(pair);
  skillIntent.tab = 'trade';
  skillIntent.pair = pair;
  S.setView('skills');
}
function goToRoutePreview(S: Store, pair: string, side: 'buy' | 'sell', usd?: string) {
  S.setSelected(pair);
  swapIntent.pair = pair;
  swapIntent.side = side;
  swapIntent.usd = usd && Number(usd) > 0 ? usd : undefined;
  swapIntent.focus = true;
  S.setView('swap');
}
function FundSkill() {
  const S = useS();
  const [chainId, setChainId] = useState('eth');
  const chain = CHAINS.find((c) => c.id === chainId)!;
  const [tokenKey, setTokenKey] = useState<SourceTok>('native');
  const srcKey = sourceTokenKey(chain, tokenKey);
  const [amount, setAmount] = useState('');
  const amt = parseFloat(amount) || 0;
  const advice = bestDestination(srcKey, chain.sodex, true);
  const asset = advice.kind === 'unsupported' ? findAsset('USDC', 'BASE') : advice.asset;
  const [quote, setQuote] = useState<NormalizedQuote | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const srcRef = chain.evm ? findRouteToken(srcKey, chain.sodex) : undefined;
  const destRef = asset ? findRouteToken(asset.token, asset.chain) : undefined;
  const direct = asset && chain.sodex === asset.chain && srcKey === asset.token;
  const run = async () => {
    if (!S.wallet || !srcRef || !destRef || !asset || !chain.evm) return;
    const smallest = toSmallest(amount, srcRef.decimals);
    if (!smallest) { setErr('Enter a valid amount.'); return; }
    setBusy(true); setErr(''); setQuote(null);
    try {
      setQuote(await fetchRouteQuote({
        user: S.wallet.address, recipient: S.wallet.address,
        originChainId: chain.evm, destinationChainId: destRef.chainId,
        originCurrency: srcRef.address, destinationCurrency: destRef.address,
        amount: smallest, originToken: srcKey, destinationToken: asset.token,
        destinationSodexChain: asset.chain, purpose: 'fund',
      }));
    } catch (e: any) {
      setErr(e?.message && !looksInternal(e.message) ? e.message : FRIENDLY_NO_ROUTE);
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-zinc-400">Pick the chain and token you already hold. This uses the official SoDEX deposit table, then a live route estimate if a route is needed. Nothing is sent from here.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="From chain"><select aria-label="Skill from chain" value={chainId} onChange={(e) => { setChainId(e.target.value); setTokenKey('native'); setQuote(null); }} className={cx(selectCls, '!pl-3')}>{CHAINS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Token"><select aria-label="Skill source token" value={tokenKey} onChange={(e) => { setTokenKey(e.target.value as SourceTok); setQuote(null); }} className={cx(selectCls, '!pl-3')}>{sourceTokens(chain).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
        <Field label="Amount"><AmountInput value={amount} onChange={(v) => { setAmount(v); setQuote(null); }} label="Amount to fund" /></Field>
      </div>
      {asset && (
        <ul className="list-disc space-y-1 rounded-xl border border-white/[0.07] bg-black/30 py-3 pl-8 pr-3 text-[13px] text-zinc-300">
          <li>Best SoDEX destination: {asset.token} on {CHAIN_LABEL[asset.chain]}{direct ? ' (direct deposit, no bridge)' : ''}.</li>
          <li>Minimum deposit: {asset.minDeposit} {asset.token} (per SoDEX docs).</li>
          <li>SoDEX withdrawal fee from that chain: {totalWithdrawFee(asset)} {asset.token} (per SoDEX docs).</li>
          {advice.kind === 'route' && <li>{advice.reason}</li>}
        </ul>
      )}
      {direct ? <Button onClick={() => S.setView('cross')}>Continue on Cross-Chain to open the SoDEX deposit</Button>
        : <Button variant="primary" loading={busy} disabled={!S.wallet || !amt || !srcRef || !destRef || busy} onClick={run}>{S.wallet ? 'Get a live route estimate' : 'Connect a wallet to estimate a route'}</Button>}
      {err && <Notice tone="error">{err}</Notice>}
      {quote && (
        <ul className="list-disc space-y-1 rounded-xl border border-white/[0.07] bg-black/30 py-3 pl-8 pr-3 text-[13px] text-zinc-300">
          <li>{providerLabel(quote.provider)}. {ESTIMATE_NOTE}</li>
          <li>You receive about {quote.outAmount} {quote.outToken}; minimum {quote.minOut} {quote.outToken}.</li>
          <li>Route fee, about {quote.feeUsd != null ? usd(quote.feeUsd, 2) : 'included in the estimate'}. Time, {formatEta(quote.etaSec)}.</li>
          <li>Recipient (your wallet): <span className="break-all font-mono text-[12px]">{quote.recipient}</span></li>
        </ul>
      )}
      <Button variant="secondary" onClick={() => S.setView('cross')}>Open Add funds</Button>
    </div>
  );
}

function WithdrawSkill() {
  const [token, setToken] = useState('USDC');
  const rows = assetsForToken(token);
  const best = cheapestWithdraw(token);
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-zinc-400">Compares official SoDEX withdrawal fees and minimums across chains for one token. The withdrawal itself stays on sodex.com.</p>
      <Field label="Token">
        <select aria-label="Skill withdraw token" value={token} onChange={(e) => setToken(e.target.value)} className={cx(selectCls, '!pl-3')}>
          {tokensWithWithdrawOptions().map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-wide text-zinc-500"><tr><th className="py-2 pr-3 font-medium">Chain</th><th className="py-2 pr-3 font-medium">Total fee</th><th className="py-2 pr-3 font-medium">Min withdrawal</th><th className="py-2 font-medium"></th></tr></thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.map((r) => {
              const cheap = best && r.chain === best.chain;
              return (
                <tr key={r.chain} className={cheap ? 'bg-emerald-500/[0.06]' : undefined}>
                  <td className="py-2 pr-3 text-zinc-100">{CHAIN_LABEL[r.chain] ?? r.chain}</td>
                  <td className="tnum py-2 pr-3">{totalWithdrawFee(r)} {r.token}</td>
                  <td className="tnum py-2 pr-3">{r.minWithdraw} {r.token}</td>
                  <td className="py-2 text-[11px] font-semibold text-emerald-300">{cheap ? 'Cheapest' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {best && <Notice tone="ok">Cheapest listed path: {best.token} on {CHAIN_LABEL[best.chain]}, fee {totalWithdrawFee(best)} {best.token}, minimum {best.minWithdraw} {best.token} (per SoDEX docs).</Notice>}
      <Button onClick={() => window.open(SODEX_SITE, '_blank', 'noopener,noreferrer')}>Open SoDEX withdrawal <ExternalLink className="h-4 w-4" /></Button>
    </div>
  );
}

function RouteCheckSkill() {
  const S = useS();
  const saved = useMemo(() => loadSavedRoute(), []);
  const [quote, setQuote] = useState<NormalizedQuote | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-zinc-400">Before you sign, check every step, the exact recipient address, the minimum you should receive, and what happens if the route is refunded. Numbers below come from a live quote or from a route already started in this browser — never from made-up data.</p>
      {quote || saved ? (
        <ul className="list-disc space-y-1 rounded-xl border border-white/[0.07] bg-black/30 py-3 pl-8 pr-3 text-[13px] text-zinc-300">
          {quote && <>
            <li>{providerLabel(quote.provider)}. {ESTIMATE_NOTE}</li>
            {quote.steps.map((s, i) => <li key={i}>Step {i + 1} of {quote.steps.length}: {s.action}. {s.description}</li>)}
            <li>Recipient (your wallet): <span className="break-all font-mono text-[12px]">{quote.recipient}</span>. Funds only go to this address.</li>
            <li>Expected minimum received: {quote.minOut} {quote.outToken}.</li>
            <li>If the route cannot complete, the status will say “Refunded to your wallet.” Nothing is retried automatically.</li>
            <li>You reject a signature, and nothing is sent.</li>
          </>}
          {!quote && saved && <>
            <li>A route was already started in this browser for {saved.destinationToken} to {CHAIN_LABEL[saved.destinationSodexChain] ?? saved.destinationSodexChain}.</li>
            <li>Recipient (your wallet): <span className="break-all font-mono text-[12px]">{saved.recipient}</span>.</li>
            <li>Expected minimum received: {saved.minOut} {saved.destinationToken}.</li>
            <li>Current status: {statusLabel(saved.status)}</li>
            <li>If the route cannot complete, the status will say “Refunded to your wallet.” Nothing is retried automatically.</li>
          </>}
        </ul>
      ) : (
        <Notice tone="info">No live quote is open yet. Use Add funds on Cross-Chain to get a route estimate, then come back here — or open that tab to review the steps, recipient and minimum before you sign.</Notice>
      )}
      <Button onClick={() => S.setView('cross')}>Open Add funds to check a route</Button>
    </div>
  );
}

function SkillsView() {
  const [tab, setTab] = useState<SkillTab>(() => { const t = skillIntent.tab; skillIntent.tab = null; return t ?? 'trade'; });
  const tabs: { value: SkillTab; label: string; tag: 'code' | 'AI'; icon: (s: number) => React.ReactNode; blurb: string }[] = [
    { value: 'trade', label: 'Trade Check', tag: 'code', icon: (s) => <TradeCheckIcon size={s} />, blurb: 'Scan a trade against the live order book before you sign.' },
    { value: 'size', label: 'Position Size', tag: 'code', icon: (s) => <PositionIcon size={s} />, blurb: 'Turn "how much can I afford to lose" into an exact size.' },
    { value: 'portfolio', label: 'Portfolio', tag: 'code', icon: (s) => <PortfolioIcon size={s} />, blurb: 'See concentration and your stablecoin cushion.' },
    { value: 'fund', label: 'Fund my SoDEX', tag: 'code', icon: (s) => <Coins size={s} />, blurb: 'Move tokens from another chain into your wallet, then deposit on SoDEX.' },
    { value: 'withdraw', label: 'Cheapest withdraw', tag: 'code', icon: (s) => <ArrowUpRight size={s} />, blurb: 'Compare official SoDEX withdrawal fees and minimums across chains.' },
    { value: 'routecheck', label: 'Check a route', tag: 'code', icon: (s) => <ShieldCheck size={s} />, blurb: 'Read every step, the recipient address, the minimum received, and refunds before you sign.' },
    { value: 'journal', label: 'Journal', tag: 'code', icon: (s) => <JournalIcon size={s} />, blurb: 'Your real results: volume, fees and realised P&L from your fills.' },
    { value: 'alerts', label: 'Price Alerts', tag: 'code', icon: (s) => <AlertIcon size={s} />, blurb: 'Get pinged when a pair crosses your price, so you never chase.' },
    { value: 'brief', label: 'Market Brief', tag: 'AI', icon: (s) => <BriefIcon size={s} />, blurb: 'A neutral read of what moved and what the data says.' },
    { value: 'news', label: 'News Impact', tag: 'AI', icon: (s) => <NewsIcon size={s} />, blurb: 'Which headlines could matter, and how sure we can be.' },
    { value: 'plan', label: 'Plan Review', tag: 'AI', icon: (s) => <PlanIcon size={s} />, blurb: 'A risk manager reads your plan and lists the gaps.' },
  ];
  const cur = tabs.find((t) => t.value === tab)!;
  return (
    <div className="mx-auto max-w-[900px]">
      <PageTitle icon={<span className="block drop-shadow-[0_0_14px_rgba(249,115,22,0.6)]"><SkillsMark size={44} /></span>} title="Skills" sub="Risk checks that run in your browser, plus AI explanations powered by Gemini." />
      <div className="mb-4"><Notice tone="warn"><span className="sm:hidden"><b>No tool can guarantee you won't lose money.</b> Nothing here places an order.</span><span className="hidden sm:inline"><b>No tool can guarantee you won't lose money.</b> These skills help you avoid the common, avoidable losses: thin order books, wide spreads, oversized positions and concentration. Nothing here places an order. Every grade comes from plain code, and the AI only explains it.</span></Notice></div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Skills">
        {tabs.map((t) => (
          <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
            className={cx('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition', tab === t.value ? 'border-orange-500/60 bg-orange-500/15 text-orange-200' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100')}>
            {t.icon(18)}{t.label}{t.tag === 'AI' && <span className="rounded bg-orange-500/15 px-1.5 text-[10px] font-semibold text-orange-300">AI</span>}
          </button>
        ))}
      </div>
      <div className="mb-3 hidden items-center gap-3 sm:flex">
        <SkillTile active>{cur.icon(30)}</SkillTile>
        <div className="min-w-0"><div className="flex items-center gap-2 text-base font-bold text-zinc-50">{cur.label}<span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">{cur.tag === 'AI' ? 'Gemini' : 'Runs in your browser'}</span></div><p className="text-[12px] text-zinc-500">{cur.blurb}</p></div>
      </div>
      <AnimatedTabs activeKey={tab}>
        {tab === 'trade' && <TradeCheck />}
        {tab === 'size' && <SizeCheck />}
        {tab === 'portfolio' && <PortfolioCheck />}
        {tab === 'fund' && <FundSkill />}
        {tab === 'withdraw' && <WithdrawSkill />}
        {tab === 'routecheck' && <RouteCheckSkill />}
        {tab === 'journal' && <JournalCard />}
        {tab === 'alerts' && <AlertsCard />}
        {tab === 'brief' && <BriefCard skill="market-brief" title="Market Brief" body="A neutral summary of what moved on SoDEX and what SoSoValue headlines and ETF flows say right now. No predictions." cta="Generate brief" />}
        {tab === 'news' && <BriefCard skill="news-impact" title="News Impact" body="Which current headlines could matter for which pairs, why, and how reliable that link is." cta="Analyse headlines" />}
        {tab === 'plan' && <PlanReview />}
      </AnimatedTabs>
    </div>
  );
}

/* ═════════════════════════ app shell ═════════════════════════ */

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home className="h-[18px] w-[18px]" /> },
  { id: 'swap', label: 'Swap', icon: <ArrowDownUp className="h-[18px] w-[18px]" /> },
  { id: 'markets', label: 'Markets', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { id: 'cross', label: 'Cross-Chain', icon: <Link2 className="h-[18px] w-[18px]" /> },
  { id: 'bots', label: 'Bots', icon: <Bot className="h-[18px] w-[18px]" /> },
  { id: 'skills', label: 'Skills', icon: <SkillsMark size={20} /> },
  { id: 'guide', label: 'Guide', icon: <BookOpen className="h-[18px] w-[18px]" /> },
];

function NetPill() {
  const S = useS();
  return (
    <button onClick={() => S.setUi('settings', true)} className="ss-btn inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-medium text-zinc-100 hover:bg-white/[0.08] sm:px-3" aria-label={`Network settings, SoDEX ${NETS[S.net].label}`}>
      <span className={cx('h-1.5 w-1.5 rounded-full', S.marketErr ? 'bg-rose-500' : 'bg-emerald-400')} /><span className={S.net === 'mainnet' ? 'hidden sm:inline' : ''}>SoDEX {NETS[S.net].label}</span>
    </button>
  );
}

function WalletButton() {
  const S = useS();
  const [open, setOpen] = useState(false);
  if (!S.wallet) return <Button variant="primary" size="sm" className="!h-8 !rounded-lg" onClick={() => S.setUi('connect', true)}>Connect Wallet</Button>;
  const item = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-zinc-200 hover:bg-white/[0.06]';
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="ss-btn inline-flex h-8 items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/[0.08] px-3 text-[11px] font-semibold text-zinc-100 hover:bg-orange-500/[0.14]">
        {S.wallet.info.icon ? <img src={S.wallet.info.icon} alt="" className="h-4 w-4 rounded" /> : <Wallet className="h-3.5 w-3.5 text-orange-400" />}<span className="tnum">{short(S.wallet.address)}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="ss-fade absolute right-0 z-50 mt-2 w-52 rounded-xl border border-white/10 bg-[#0a0a0c] p-1.5 shadow-2xl">
            <button role="menuitem" className={item} onClick={() => { setOpen(false); S.setView('portfolio'); }}><History className="h-4 w-4 text-orange-400" />Portfolio & orders</button>
            <button role="menuitem" className={item} onClick={() => { setOpen(false); S.setUi('connect', true); }}><KeyRound className="h-4 w-4 text-orange-400" />Wallet & trading key</button>
            <button role="menuitem" className={item} onClick={() => { setOpen(false); S.setUi('settings', true); }}><Settings className="h-4 w-4 text-orange-400" />Settings</button>
            <button role="menuitem" className={item} onClick={() => { setOpen(false); S.disconnect(); S.forgetKey(); }}><LogOut className="h-4 w-4 text-orange-400" />Disconnect</button>
          </div>
        </>
      )}
    </div>
  );
}

function Shell() {
  const S = useS();
  const view = S.view;
  useEffect(() => {
    document.documentElement.dataset.soswapView = view;
    return () => { delete document.documentElement.dataset.soswapView; };
  }, [view]);
  const Page = { home: HomeView, swap: SwapView, markets: MarketsHub, cross: CrossChainView, bots: BotsView, skills: SkillsView, guide: GuideView, portfolio: PortfolioView }[view];
  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans text-zinc-200">
      <div aria-hidden className="ss-bg"><div className="ss-bg-grid" /><div className="ss-bg-grain" /></div>

      <header className="ss-header sticky top-0 z-40 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-4 py-2.5">
          <button onClick={() => S.setView('home')} className="flex items-center gap-2" aria-label="SoSwapDEX home"><Logo size={32} /><Wordmark /></button>
          <LayoutGroup id="nav-d">
            <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
              {NAV.filter((n) => n.id !== 'home').map((n) => (
                <button key={n.id} onClick={() => S.setView(n.id)} aria-current={view === n.id ? 'page' : undefined}
                  className={cx('relative px-3 py-2 text-[13px] font-medium transition-colors duration-150', view === n.id ? 'text-orange-400' : 'text-zinc-300 hover:text-zinc-50')}>
                  {n.label}{view === n.id && <motion.span layoutId="nav-ul" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]" />}
                </button>
              ))}
            </nav>
          </LayoutGroup>
          <div className="ml-auto flex items-center gap-2"><NetPill /><WalletButton /></div>
        </div>
        <LayoutGroup id="nav-m">
          <nav aria-label="Primary mobile" className="mx-auto flex max-w-[1180px] justify-between gap-0.5 overflow-x-auto px-2 pb-1 md:hidden">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => S.setView(n.id)} aria-current={view === n.id ? 'page' : undefined}
                className={cx('relative flex min-h-[48px] min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap px-1 pb-2 pt-1 text-[10px] font-medium transition-colors duration-150 active:scale-95', view === n.id ? 'text-orange-400' : 'text-zinc-400')}>
                {n.icon}{n.label}
                {view === n.id && <motion.span layoutId="nav-ul-m" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)]" />}
              </button>
            ))}
          </nav>
        </LayoutGroup>
      </header>

      <main className="relative z-10 mx-auto min-h-[70vh] max-w-[1180px] px-4 pb-28 pt-6 sm:pb-10">
        <AnimatePresence mode="wait" initial={false}><MotionPage key={view}><Page /></MotionPage></AnimatePresence>
        <footer className="mt-12 border-t border-white/[0.06] pt-5 pr-0 text-[11px] max-[520px]:pr-20 leading-relaxed text-zinc-600">{DISCLAIMER}</footer>
      </main>

      <WalletModal /><KeyModal /><SettingsModal />

      <div className="pointer-events-none fixed bottom-24 right-4 z-[70] sm:bottom-4 flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {S.toasts.map((t) => (
            <motion.div key={t.id} layout="position" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 28, transition: { duration: 0.18 } }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={cx('pointer-events-auto rounded-xl border px-4 py-3 text-[13px] leading-snug shadow-2xl', t.kind === 'ok' ? 'border-emerald-500/40 bg-emerald-950/95 text-emerald-100' : t.kind === 'err' ? 'border-rose-500/40 bg-rose-950/95 text-rose-100' : 'border-white/15 bg-zinc-900/95 text-zinc-100')}>{t.text}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SoSwapPage() {
  const store = useSoSwapStore();
  return <Ctx.Provider value={store}><AlertsHost><ArmHost><Shell /></ArmHost></AlertsHost></Ctx.Provider>;
}
