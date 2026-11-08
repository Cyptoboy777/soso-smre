'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPair } from '@/lib/display';
import {
  connectInjectedWallet,
  hasInjectedWallet,
  readWalletChainId,
  signTypedData,
} from '@/lib/wallet-browser';
import type { ExecutionReceipt } from '@/lib/order-receipt';
import type { Thesis } from '@/types/flow';

type BookLevel = { price: number; qty: number };
type Preview = {
  networkLabel: string;
  tradingLive: boolean;
  book: { bids: BookLevel[]; asks: BookLevel[]; fetchedAt: string; source: string } | null;
  cost: {
    state: string;
    mid: number | null;
    spreadBps: number | null;
    imbalance: number | null;
    slippageBps: number | null;
    resting: boolean;
    complete: boolean;
    lines: Array<{ label: string; amount: string | null; state: string; detail: string }>;
    stress: Array<{ label: string; state: string; detail: string }>;
    budgetDetail: string;
  };
  evidence: {
    state: string;
    detail: string;
    items: Array<{
      title: string;
      url?: string;
      publishedAt: string;
      observedMovePct: number | null;
      observation: string;
      alternate: string;
    }>;
  };
  selfTrade: { state: string; detail: string };
  unavailable: Array<{ name: string; reason: string }>;
};

type Cfg = {
  builderId: number | null;
  appFeePercent: string;
  maxApprovalPercent: string;
  maxNotionalUsdc: number;
  maxApproval: number;
  tradingLive: boolean;
  realFundsWarning: string | null;
  feeDisclosure?: { caps: string; spotBuyExempt: string; perpsBothSides: string };
};

type Prepared = {
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  params: Record<string, unknown>;
  nonce: string;
  network: 'mainnet' | 'testnet';
  payloadHash: string;
  feeDisclosure: { feeLabel: string; spotBuyNote: string };
  confirmSummary: { quantity: string; price?: string; side: string; type: string };
};

type Stage =
  | 'review'
  | 'prepared'
  | 'awaiting-signature'
  | 'submitting'
  | 'accepted'
  | 'rejected'
  | 'ambiguous'
  | 'wallet-rejected';

const VALUE_CHAINS = new Set([286623, 138565]);

function num(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function ExecutionTicket({ thesis, quantity }: { thesis: Thesis; quantity: number }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>(thesis.side === 'SHORT' ? 'sell' : 'buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [price, setPrice] = useState(thesis.entry > 0 ? String(thesis.entry) : '');
  const [size, setSize] = useState(quantity > 0 ? String(quantity) : '');
  const [budget, setBudget] = useState('');
  const [includeBuilder, setIncludeBuilder] = useState(false);
  const [feeAck, setFeeAck] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [fundsAck, setFundsAck] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [reconcile, setReconcile] = useState<string | null>(null);
  const [balances, setBalances] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('review');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);

  const symbol = thesis.symbol || 'vBTC_vUSDC';

  useEffect(() => {
    void fetch('/api/builder/config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json) return;
        setCfg(json as Cfg);
        if ((json as Cfg).tradingLive && !sessionStorage.getItem('fs-funds-ack')) setFundsAck(false);
      })
      .catch(() => setPreviewError('The trading setup could not be loaded.'));
  }, []);

  const loadPreview = useCallback(async () => {
    const params = new URLSearchParams({
      symbol,
      side,
      type: orderType,
      quantity: size || '0',
      price: price || '0',
      includeBuilder: includeBuilder ? '1' : '0',
    });
    if (budget) params.set('budget', budget);
    if (address) params.set('address', address);
    const res = await fetch(`/api/builder/preview?${params}`, { cache: 'no-store' });
    const json = (await res.json()) as Preview & { error?: string };
    if (!res.ok) throw new Error(json.error ?? 'The book could not be loaded.');
    setPreview(json);
    setPreviewError(null);
  }, [address, budget, includeBuilder, orderType, price, side, size, symbol]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPreview().catch((e: unknown) => {
        setPreview(null);
        setPreviewError(e instanceof Error ? e.message : 'The book could not be loaded.');
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [loadPreview]);

  function edit(next: () => void) {
    next();
    setPrepared(null);
    setReceipt(null);
    setReconcile(null);
    if (stage !== 'submitting' && stage !== 'awaiting-signature') setStage('review');
  }

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      if (!hasInjectedWallet()) throw new Error('No browser wallet found.');
      const addr = await connectInjectedWallet();
      setAddress(addr);
      setChainId(await readWalletChainId());
      const net = cfg?.tradingLive ? 'mainnet' : 'testnet';
      const acc = await fetch(`/api/builder/account?address=${addr}&network=${net}`);
      const json = (await acc.json()) as { accountId?: number | null; error?: string };
      if (!acc.ok) throw new Error(json.error ?? 'Could not load your account.');
      setAccountId(json.accountId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect the wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function approveFee() {
    if (!address || !accountId || !cfg?.builderId) return;
    setBusy(true);
    setError(null);
    try {
      const prep = await fetch('/api/builder/prepare-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          accountId,
          network: cfg.tradingLive ? 'mainnet' : 'testnet',
          maxFeeRate: cfg.maxApproval,
        }),
      });
      const prepJson = (await prep.json()) as {
        error?: string;
        prepared?: {
          typedData: Prepared['typedData'];
          apiChain: number;
          nonce: string;
          network: 'mainnet' | 'testnet';
          requestBody: { accountID: number; builderID: number; maxFeeRate: number };
        };
      };
      if (!prep.ok || !prepJson.prepared) throw new Error(prepJson.error ?? 'Could not prepare the fee approval.');
      const sig = await signTypedData(address, prepJson.prepared.typedData);
      const relay = await fetch('/api/builder/relay-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          network: prepJson.prepared.network,
          apiChain: prepJson.prepared.apiChain,
          nonce: prepJson.prepared.nonce,
          signature: sig,
          ...prepJson.prepared.requestBody,
        }),
      });
      const relayJson = (await relay.json()) as { error?: string };
      if (!relay.ok) throw new Error(relayJson.error ?? 'The fee approval was not accepted.');
      setApproved(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(/reject|denied/i.test(message) ? 'You rejected the signature. Nothing was sent.' : 'The fee approval was not completed.');
    } finally {
      setBusy(false);
    }
  }

  async function reviewAndSign() {
    if (!address || !accountId || !confirmOrder || !preview?.book) return;
    if (includeBuilder && !feeAck) return;
    if (preview.selfTrade.state === 'blocked') {
      setError(preview.selfTrade.detail);
      return;
    }
    setBusy(true);
    setError(null);
    setStage('prepared');
    try {
      const prep = await fetch('/api/builder/prepare-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          accountId,
          network: cfg?.tradingLive ? 'mainnet' : 'testnet',
          symbol,
          side,
          type: orderType,
          quantity: size,
          price: orderType === 'limit' ? price : undefined,
          confirmed: true,
          includeBuilder,
          requireFreshQuote: true,
          quoteFetchedAt: preview.book.fetchedAt,
        }),
      });
      const prepJson = (await prep.json()) as { error?: string; prepared?: Prepared };
      if (!prep.ok || !prepJson.prepared) throw new Error(prepJson.error ?? 'The order could not be prepared.');
      setPrepared(prepJson.prepared);
      setStage('awaiting-signature');
      const sig = await signTypedData(address, prepJson.prepared.typedData);
      setStage('submitting');
      const relay = await fetch('/api/builder/relay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          network: prepJson.prepared.network,
          params: prepJson.prepared.params,
          nonce: prepJson.prepared.nonce,
          signature: sig,
          confirmed: true,
        }),
      });
      const relayJson = (await relay.json()) as { error?: string; receipt?: ExecutionReceipt };
      if (!relay.ok && !relayJson.receipt) throw new Error(relayJson.error ?? 'The order was not accepted.');
      const next = relayJson.receipt ?? null;
      setReceipt(next);
      setStage(next?.stage === 'accepted' ? 'accepted' : next?.stage === 'rejected' ? 'rejected' : 'ambiguous');
      setConfirmOrder(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (/reject|denied/i.test(message)) {
        setStage('wallet-rejected');
        setError('You rejected the signature. No order was sent.');
      } else {
        setStage('review');
        setError(message || 'The order was not sent.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function reconcileOrder() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ address, network: cfg?.tradingLive ? 'mainnet' : 'testnet' });
      if (accountId) params.set('accountId', String(accountId));
      const res = await fetch(`/api/builder/orders?${params}`, { cache: 'no-store' });
      const json = (await res.json()) as {
        error?: string;
        ordersAvailable?: boolean;
        balancesAvailable?: boolean;
        balances?: Array<{ asset: string; total: string }>;
        open?: Array<{ orderId: string | null; status: string }>;
        history?: Array<{ orderId: string | null; status: string }>;
      };
      if (!res.ok) throw new Error(json.error ?? 'Orders could not be read.');
      if (!json.ordersAvailable) {
        setReconcile('Orders could not be read. The earlier response still stands.');
      } else {
        const rows = [...(json.open ?? []), ...(json.history ?? [])];
        const hit = rows.find((row) => row.orderId && row.orderId === receipt?.orderId);
        setReconcile(
          hit
            ? `Latest account status: ${hit.status}.`
            : 'This order id is not in the latest open orders or recent history. That does not prove a fill or a cancel.',
        );
      }
      setBalances(
        json.balancesAvailable
          ? json.balances && json.balances.length
            ? json.balances.map((row) => `${row.asset} ${row.total}`).join(' · ')
            : 'The account returned no balances.'
          : 'Balances could not be read.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Orders could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!address || !accountId || !receipt?.orderId || !confirmCancel) return;
    setBusy(true);
    setError(null);
    try {
      const clientId = receipt.clientOrderId ?? undefined;
      const prep = await fetch('/api/builder/prepare-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          accountId,
          network: cfg?.tradingLive ? 'mainnet' : 'testnet',
          symbol,
          orderId: receipt.orderId,
          origClOrdID: clientId,
          confirmed: true,
        }),
      });
      const prepJson = (await prep.json()) as { error?: string; prepared?: Prepared };
      if (!prep.ok || !prepJson.prepared) throw new Error(prepJson.error ?? 'The cancel could not be prepared.');
      const sig = await signTypedData(address, prepJson.prepared.typedData);
      const relay = await fetch('/api/builder/relay-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          network: prepJson.prepared.network,
          params: prepJson.prepared.params,
          nonce: prepJson.prepared.nonce,
          signature: sig,
          confirmed: true,
        }),
      });
      const relayJson = (await relay.json()) as { error?: string; receipt?: ExecutionReceipt };
      if (!relay.ok && !relayJson.receipt) throw new Error(relayJson.error ?? 'The cancel was not accepted.');
      setReceipt(relayJson.receipt ?? receipt);
      setConfirmCancel(false);
      setReconcile('Cancel response received. Reconcile before treating the size as closed.');
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(/reject|denied/i.test(message) ? 'You rejected the cancel signature. The order was not cancelled by this action.' : message || 'The cancel was not sent.');
    } finally {
      setBusy(false);
    }
  }

  const asks = useMemo(() => [...(preview?.book?.asks ?? [])].reverse(), [preview]);
  const wrongChain = chainId != null && !VALUE_CHAINS.has(chainId);
  const stageLabel: Record<Stage, string> = {
    review: 'Review',
    prepared: 'Prepared',
    'awaiting-signature': 'Awaiting your signature',
    submitting: 'Submitted, waiting for the exchange',
    accepted: 'Accepted, not filled',
    rejected: 'Rejected',
    ambiguous: 'Needs reconciliation',
    'wallet-rejected': 'Signature declined',
  };

  return (
    <section className="execution" aria-label="SoDEX order">
      <header className="execution-head">
        <div>
          <h2>Spot order</h2>
          <p>
            {formatPair(symbol)} on {preview?.networkLabel ?? 'SoDEX'}. You sign each order. News and the assistant cannot send one.
          </p>
        </div>
        <span className={`badge ${cfg?.tradingLive ? 'live' : 'fallback'}`}>
          {cfg?.tradingLive ? 'Mainnet signing' : 'Practice network'}
        </span>
      </header>

      {!cfg?.tradingLive ? (
        <p className="execution-note">
          Mainnet trading is not enabled. A signature on this deployment is prepared for the practice network. This build has not been checked against a live fill.
        </p>
      ) : null}

      {!fundsAck && cfg?.realFundsWarning ? (
        <div className="execution-warn" role="dialog" aria-labelledby="funds-title">
          <h3 id="funds-title">Real funds</h3>
          <p>{cfg.realFundsWarning}</p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              sessionStorage.setItem('fs-funds-ack', '1');
              setFundsAck(true);
            }}
          >
            I understand
          </button>
        </div>
      ) : null}

      <div className="execution-grid">
        <div className="panel">
          <div className="panel-head">
            <strong>Book</strong>
            <span className="badge">{preview?.book ? preview.book.source : 'Unavailable'}</span>
          </div>
          <div className="panel-body">
            {preview?.book ? (
              <>
                <p className="execution-meta tabular">
                  Mid {num(preview.cost.mid)} · Spread {preview.cost.spreadBps == null ? '—' : `${preview.cost.spreadBps.toFixed(2)} bps`} · Bid share{' '}
                  {preview.cost.imbalance == null ? '—' : `${(preview.cost.imbalance * 100).toFixed(1)}%`}
                </p>
                <p className="execution-meta">As of {new Date(preview.book.fetchedAt).toISOString()} UTC. {preview.cost.state === 'stale' ? 'This quote is stale.' : ''}</p>
                <div className="book-table" role="table" aria-label="Order book">
                  {asks.map((level) => (
                    <div key={`a-${level.price}`} className="book-row ask" role="row">
                      <span className="tabular">{num(level.price, 4)}</span>
                      <span className="tabular">{num(level.qty, 6)}</span>
                    </div>
                  ))}
                  <div className="book-spread">Spread</div>
                  {(preview.book.bids ?? []).map((level) => (
                    <div key={`b-${level.price}`} className="book-row bid" role="row">
                      <span className="tabular">{num(level.price, 4)}</span>
                      <span className="tabular">{num(level.qty, 6)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>{previewError ?? 'The practice-network book is not available. No estimate was substituted from another market.'}</p>
            )}
          </div>
        </div>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            void reviewAndSign();
          }}
        >
          <div className="panel-head">
            <strong>{stageLabel[stage]}</strong>
          </div>
          <div className="panel-body execution-form">
            <div className="segmented" role="group" aria-label="Side">
              {(['buy', 'sell'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={side === value} onClick={() => edit(() => setSide(value))}>
                  {value === 'buy' ? 'Buy' : 'Sell'}
                </button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Order type">
              {(['limit', 'market'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={orderType === value} onClick={() => edit(() => setOrderType(value))}>
                  {value === 'limit' ? 'Limit' : 'Market'}
                </button>
              ))}
            </div>
            {orderType === 'limit' ? (
              <label>
                Limit price
                <input className="field" inputMode="decimal" value={price} onChange={(e) => edit(() => setPrice(e.target.value))} />
              </label>
            ) : null}
            <label>
              {orderType === 'market' && side === 'buy' ? 'Quote size' : 'Base size'}
              <input className="field" inputMode="decimal" value={size} onChange={(e) => edit(() => setSize(e.target.value))} />
            </label>
            <label>
              Risk budget (USDC)
              <input className="field" inputMode="decimal" value={budget} onChange={(e) => edit(() => setBudget(e.target.value))} />
            </label>
            <p className="execution-meta">Cap per order {cfg?.maxNotionalUsdc ?? '—'} quote. Stop, take-profit, and perps are not part of this signature.</p>
            <label className="check">
              <input
                type="checkbox"
                checked={includeBuilder}
                disabled={!cfg?.builderId}
                onChange={(e) => edit(() => setIncludeBuilder(e.target.checked))}
              />
              <span>
                {cfg && !cfg.builderId
                  ? 'App fee tagging is not configured on this deployment, so the order is sent without it.'
                  : 'Tag the app fee before signing. Leave this off and the tag is omitted. Spot buys do not pay it either way. The builder balance requirement is not a deposit from you.'}
              </span>
            </label>
            {includeBuilder ? (
              <label className="check">
                <input type="checkbox" checked={feeAck} onChange={(e) => setFeeAck(e.target.checked)} />
                <span>{cfg?.feeDisclosure?.caps} {cfg?.feeDisclosure?.spotBuyExempt}</span>
              </label>
            ) : null}
            <label className="check">
              <input type="checkbox" checked={confirmOrder} onChange={(e) => setConfirmOrder(e.target.checked)} />
              <span>
                I confirm this {side} {orderType} on {formatPair(symbol)}. Only this signature sends it.
              </span>
            </label>
            <div className="execution-actions">
              <button className="btn" type="button" onClick={() => void connect()} disabled={busy}>
                {address ? 'Refresh wallet' : 'Connect wallet'}
              </button>
              <button className="btn" type="button" disabled={busy || !address || !accountId || !cfg?.builderId || approved} onClick={() => void approveFee()}>
                {approved ? 'App fee approved' : 'Approve app fee'}
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  busy ||
                  !address ||
                  !accountId ||
                  !confirmOrder ||
                  (includeBuilder && !feeAck) ||
                  !preview?.book ||
                  preview.cost.state === 'stale' ||
                  preview.selfTrade.state === 'blocked' ||
                  stage === 'ambiguous' ||
                  stage === 'accepted'
                }
              >
                {busy ? 'Working…' : 'Sign order'}
              </button>
            </div>
            {address ? <p className="execution-meta">Wallet {address.slice(0, 6)}…{address.slice(-4)} {accountId ? `· account ${accountId}` : '· no trading account yet'}</p> : null}
            {wrongChain ? (
              <p className="execution-note">
                Your wallet is on another network. The SoDEX signature uses the ValueChain domain and does not submit a transaction on the wallet&apos;s current chain. This is not an order rejection.
              </p>
            ) : null}
            {error ? <p role="alert" className="execution-alert">{error}</p> : null}
            {prepared ? (
              <p className="execution-meta">
                Prepared {prepared.confirmSummary.side} {prepared.confirmSummary.type} {prepared.confirmSummary.quantity}
                {prepared.confirmSummary.price ? ` @ ${prepared.confirmSummary.price}` : ''}. {prepared.feeDisclosure.feeLabel}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      <div className="execution-grid">
        <article className="panel">
          <div className="panel-head"><strong>Cost and stress</strong></div>
          <div className="panel-body">
            <p className="execution-meta">{preview?.cost.budgetDetail}</p>
            <ul className="plain-list">
              {(preview?.cost.lines ?? []).map((line) => (
                <li key={line.label} className="cost-line">
                  <strong>{line.label}</strong>
                  <span className="tabular cost-amount">{line.amount ?? 'Unavailable'}</span>
                  <span>{line.detail}</span>
                </li>
              ))}
              {(preview?.cost.stress ?? []).map((row) => (
                <li key={row.label}>
                  <strong>{row.label}</strong>
                  <span>{row.detail}</span>
                </li>
              ))}
            </ul>
            <p className="execution-meta">{preview?.selfTrade.detail}</p>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head"><strong>Evidence</strong></div>
          <div className="panel-body">
            <p>{preview?.evidence.detail ?? 'News has not loaded.'}</p>
            <ul className="plain-list">
              {(preview?.evidence.items ?? []).map((item) => (
                <li key={item.publishedAt + item.title}>
                  <strong>{item.title}</strong>
                  <span className="execution-meta">{item.publishedAt} UTC source time</span>
                  <span>{item.observation}</span>
                  <span>{item.alternate}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <article className="panel execution-receipt" aria-live="polite">
        <div className="panel-head"><strong>Receipt</strong></div>
        <div className="panel-body">
          {receipt ? (
            <>
              <p>{receipt.message}</p>
              <p className="tabular">Order {receipt.orderId ?? 'not returned'} · Client {receipt.clientOrderId ?? '—'}</p>
              <p className="execution-meta">Do not send this payload again. A new order needs a new review.</p>
              {reconcile ? <p>{reconcile}</p> : null}
              {balances ? <p className="execution-meta">Balances: {balances}</p> : null}
              <div className="execution-actions">
                <button className="btn" type="button" onClick={() => void reconcileOrder()} disabled={busy || !address}>
                  Reconcile
                </button>
                {stage === 'ambiguous' || stage === 'rejected' ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setReceipt(null);
                      setPrepared(null);
                      setStage('review');
                      setReconcile(null);
                    }}
                  >
                    Review a new order
                  </button>
                ) : null}
              </div>
              {receipt.orderId && receipt.stage === 'accepted' ? (
                <div className="execution-cancel">
                  <label className="check">
                    <input type="checkbox" checked={confirmCancel} onChange={(e) => setConfirmCancel(e.target.checked)} />
                    <span>I want to cancel order {receipt.orderId}. This is a separate signature and may leave a filled size in place.</span>
                  </label>
                  <button className="btn" type="button" disabled={busy || !confirmCancel} onClick={() => void cancelOrder()}>
                    Sign cancel
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p>No order has been sent from this ticket.</p>
          )}
        </div>
      </article>

      {preview?.unavailable?.length ? (
        <ul className="plain-list gap-note">
          {preview.unavailable.map((item) => (
            <li key={item.name}><strong>{item.name}</strong> <span>{item.reason}</span></li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
