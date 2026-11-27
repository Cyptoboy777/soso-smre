'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Box, CheckCircle2, CircleDollarSign, Gift, Loader2, RefreshCw, ShieldCheck, Sparkles, Trophy, Wallet } from 'lucide-react';

type WalletSession = { address: string; info: { provider: { request: (args: { method: string; params?: unknown[] }) => Promise<string> } } } | null;
type Net = 'mainnet' | 'testnet';
type Props = { wallet: WalletSession; net: Net; onConnect: () => void; onTrade: () => void };
type ApiResult = { code?: number; msg?: string; data?: any; error?: string };

const endpoint = (net: Net, path: string) => `/api/sodex/${net}/api/v1/${path}`;

async function callApi(net: Net, path: string, token?: string, body?: unknown): Promise<any> {
  const response = await fetch(endpoint(net, path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json() as ApiResult;
  if (!response.ok || (result.code !== undefined && result.code !== 0)) throw new Error(result.msg || result.error || `SoDEX Rewards returned ${response.status}`);
  return result.data ?? result;
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const fmt = (value: unknown) => typeof value === 'number' ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value) : (value ?? '—').toString();

export function WealthHub({ wallet, net, onConnect, onTrade }: Props) {
  const [token, setToken] = useState('');
  const [sessionAddress, setSessionAddress] = useState('');
  const [treasures, setTreasures] = useState<any>(null);
  const [points, setPoints] = useState<any>(null);
  const [week, setWeek] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const signedIn = Boolean(token && wallet && sessionAddress.toLowerCase() === wallet.address.toLowerCase());
  useEffect(() => {
    setToken(''); setSessionAddress(''); setTreasures(null); setPoints(null); setWeek(null); setJob(null);
  }, [wallet?.address, net]);

  async function refresh(accessToken = token) {
    if (!wallet || !accessToken) return;
    setBusy('refresh'); setError('');
    try {
      const [t, p, w] = await Promise.all([
        callApi(net, 'lottery/treasures', accessToken),
        callApi(net, 'sopoints/summary', accessToken),
        callApi(net, 'sopoints/week/info'),
      ]);
      setTreasures(t); setPoints(p); setWeek(w);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load SoDEX rewards.'); }
    finally { setBusy(''); }
  }

  async function signIn() {
    if (!wallet) { onConnect(); return; }
    setBusy('signin'); setError(''); setNotice('');
    try {
      const challenge = await callApi(net, 'auth/nonce', undefined, { address: wallet.address, type: 'sign_in' });
      if (!challenge.message) throw new Error('SoDEX did not return a wallet challenge.');
      const signature = await wallet.info.provider.request({ method: 'personal_sign', params: [challenge.message, wallet.address] });
      const verified = await callApi(net, 'auth/verify', undefined, { address: wallet.address, type: 'sign_in', message: challenge.message, signature, autoSign: false });
      if (!verified.accessToken) throw new Error('SoDEX did not return an access token.');
      setToken(verified.accessToken); setSessionAddress(wallet.address); setNotice('Wallet verified with SoDEX.');
      await refresh(verified.accessToken);
    } catch (e) { setError(e instanceof Error ? e.message : 'Wallet sign-in was not completed.'); }
    finally { setBusy(''); }
  }

  async function claim() {
    setBusy('claim'); setError(''); setNotice('');
    try {
      const result = await callApi(net, 'lottery/treasure/open', token, { count: 0 });
      setJob(result); setNotice(`Claim submitted${result.jobId ? ` · job #${result.jobId}` : ''}. Check its status below.`);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not claim Blind Box rewards.'); }
    finally { setBusy(''); }
  }

  async function checkJob() {
    if (!job?.jobId) return;
    setBusy('job'); setError('');
    try { setJob(await callApi(net, `lottery/job/${encodeURIComponent(String(job.jobId))}`, token)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to check claim status.'); }
    finally { setBusy(''); }
  }

  const card = 'rounded-2xl border border-white/[0.08] bg-[#111114]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)]';
  const label = 'text-[11px] font-semibold uppercase tracking-[.16em] text-zinc-500';
  const stat = 'mt-2 text-2xl font-semibold tracking-tight text-zinc-50';

  return <section className="space-y-5" aria-labelledby="wealth-title">
    <div className="relative overflow-hidden rounded-[26px] border border-orange-400/20 bg-[radial-gradient(ellipse_at_80%_0%,rgba(249,115,22,.18),transparent_45%),linear-gradient(135deg,#171311,#101012_65%)] p-6 sm:p-8">
      <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border border-orange-300/10" aria-hidden="true" />
      <div className="relative max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/[0.08] px-3 py-1.5 text-[11px] font-medium text-orange-200"><Sparkles className="h-3.5 w-3.5" />SoDEX ecosystem</div>
        <h1 id="wealth-title" className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Wealth, beyond the trade.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">Explore trending tech markets, track your SoPoints, and claim Blind Box rewards — all with your connected SoDEX wallet.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onTrade} className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-400">Explore markets <ArrowUpRight className="h-4 w-4" /></button>
          {!signedIn && <button onClick={wallet ? signIn : onConnect} disabled={Boolean(busy)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08] disabled:opacity-50">{busy === 'signin' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}{wallet ? 'Sign in for rewards' : 'Connect wallet'}</button>}
          {signedIn && <button onClick={() => refresh()} disabled={Boolean(busy)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />Refresh rewards</button>}
        </div>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      <article className={card}><div className="flex items-center justify-between"><span className={label}>Tech assets</span><CircleDollarSign className="h-5 w-5 text-orange-300" /></div><div className={stat}>Spot &amp; Perps</div><p className="mt-2 text-xs leading-5 text-zinc-500">Find new technology-linked markets and the Anthropic Believers Index in SoDEX markets.</p><button onClick={onTrade} className="mt-4 text-xs font-semibold text-orange-300 hover:text-orange-200">Browse live markets <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button></article>
      <article className={card}><div className="flex items-center justify-between"><span className={label}>Layer 1 Season</span><Trophy className="h-5 w-5 text-amber-300" /></div><div className={stat}>{signedIn ? fmt(points?.totalPoints) : '—'} <span className="text-sm font-medium text-zinc-500">points</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">{signedIn ? `Tier ${points?.currentTier ?? '—'}${points?.rank ? ` · Rank #${points.rank}` : ''}` : 'Sign in with your wallet to view your SoPoints and tier.'}</p><div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs"><span className="text-zinc-500">{week?.weekName ?? 'Current week'}</span><span className="text-zinc-300">{week?.weekPoolPoints ? `${fmt(week.weekPoolPoints)} pool` : 'Weekly standings'}</span></div></article>
      <article className={card}><div className="flex items-center justify-between"><span className={label}>Blind Box rewards</span><Gift className="h-5 w-5 text-orange-300" /></div><div className={stat}>{signedIn ? fmt(treasures?.total) : '—'} <span className="text-sm font-medium text-zinc-500">claimable</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">Claim eligible Treasure Boxes to your wallet and follow the reward job status.</p>{signedIn && <button onClick={claim} disabled={!Number(treasures?.total) || Boolean(busy)} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-orange-400/25 bg-orange-400/[0.08] px-3 text-xs font-semibold text-orange-200 hover:bg-orange-400/[0.14] disabled:cursor-not-allowed disabled:opacity-40">{busy === 'claim' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Box className="h-3.5 w-3.5" />}{Number(treasures?.total) ? 'Claim available boxes' : 'No boxes available'}</button>}</article>
    </div>

    {signedIn && <div className="grid gap-4 md:grid-cols-2">
      <article className={card}><div className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><ShieldCheck className="h-4 w-4 text-emerald-300" />Wallet rewards session</div><p className="mt-2 text-xs text-zinc-500">Signed in as <span className="font-mono text-zinc-300">{shortAddress(wallet!.address)}</span>. Your token stays in this tab and is cleared when you disconnect.</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400"><span>Base <b className="text-zinc-200">{fmt(points?.basePoints)}</b></span><span>Boost <b className="text-zinc-200">{fmt(points?.boostPoints)}</b></span><span>Referral <b className="text-zinc-200">{fmt(points?.referralPoints)}</b></span><span>Next tier <b className="text-zinc-200">{fmt(points?.nextTierPoints)}</b></span></div></article>
      {job?.jobId && <article className={card}><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><CheckCircle2 className="h-4 w-4 text-orange-300" />Claim job #{job.jobId}</div><button onClick={checkJob} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 text-xs text-orange-200 hover:text-orange-100 disabled:opacity-50">{busy === 'job' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Check status</button></div><p className="mt-2 text-xs text-zinc-400">Status: <span className="font-medium capitalize text-zinc-100">{job.status ?? 'submitted'}</span></p>{Array.isArray(job.minted) && <p className="mt-1 text-xs text-zinc-500">{job.minted.length} box{job.minted.length === 1 ? '' : 'es'} minted</p>}</article>}
    </div>}
    {error && <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</div>}
    <p className="px-1 text-[11px] leading-5 text-zinc-600">Rewards and points are provided by SoDEX and may be subject to eligibility, campaign rules and availability. Always review transaction details before signing.</p>
  </section>;
}
