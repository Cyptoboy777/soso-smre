'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  connectInjectedWallet,
  hasInjectedWallet,
  signTypedData,
} from '@/lib/wallet-browser';
import type { Thesis } from '@/types/flow';

type BuilderConfigResp = {
  builderId: number | null;
  builderFee: number;
  feeLabel: string;
  maxApproval: number;
  maxApprovalLabel: string;
  mainnetTradingEnabled: boolean;
  network: 'mainnet' | 'testnet';
  maxNotionalUsdc: number;
  builderReady: boolean;
  notes: string[];
  metrics: {
    ordersRouted: number;
    uniqueWallets: number;
    dryRuns: number;
    lastOrderAt: string | null;
    note: string;
  };
};

type Props = {
  thesis: Thesis;
  quantity: number;
  onPrefillOnlyNote?: string;
};

export function BuilderTradePanel({ thesis, quantity }: Props) {
  const [cfg, setCfg] = useState<BuilderConfigResp | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState(false);
  const [feeAck, setFeeAck] = useState(false);

  const loadCfg = useCallback(async () => {
    const res = await fetch('/api/builder/config', { cache: 'no-store' });
    if (res.ok) setCfg((await res.json()) as BuilderConfigResp);
  }, []);

  useEffect(() => {
    void loadCfg();
  }, [loadCfg]);

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      if (!hasInjectedWallet()) {
        throw new Error('No browser wallet found.');
      }
      const addr = await connectInjectedWallet();
      setAddress(addr);
      const net = cfg?.network ?? 'testnet';
      const acc = await fetch(
        `/api/builder/account?address=${encodeURIComponent(addr)}&network=${net}`,
      );
      const json = (await acc.json()) as {
        accountId?: number | null;
        error?: string;
        builders?: { data?: { spot?: Array<{ builderID: number }> } };
      };
      if (!acc.ok) throw new Error(json.error ?? 'Account lookup failed');
      setAccountId(json.accountId ?? null);
      const ours = cfg?.builderId;
      const spot = json.builders && typeof json.builders === 'object'
        ? (json.builders as { data?: { spot?: Array<{ builderID: number }> } }).data?.spot
        : undefined;
      if (ours && Array.isArray(spot) && spot.some((b) => b.builderID === ours)) {
        setApproved(true);
      }
      setStatus(
        json.accountId
          ? `Connected ${addr.slice(0, 6)}…${addr.slice(-4)} · account ${json.accountId}`
          : `Connected ${addr.slice(0, 6)}…${addr.slice(-4)} · SoDEX account not activated yet`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function approveBuilder() {
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
          network: cfg.network,
          maxFeeRate: cfg.maxApproval,
        }),
      });
      const prepJson = (await prep.json()) as {
        error?: string;
        prepared?: {
          typedData: {
            domain: Record<string, unknown>;
            types: Record<string, Array<{ name: string; type: string }>>;
            primaryType: string;
            message: Record<string, unknown>;
          };
          apiChain: number;
          nonce: string;
          requestBody: { accountID: number; builderID: number; maxFeeRate: number };
          network: 'mainnet' | 'testnet';
          maxFeeLabel: string;
        };
        disclosure?: { note: string };
      };
      if (!prep.ok || !prepJson.prepared) {
        throw new Error(prepJson.error ?? 'Prepare approval failed');
      }
      setStatus(
        `Approve max builder fee ${prepJson.prepared.maxFeeLabel} for Builder ID ${cfg.builderId}? Sign in your wallet…`,
      );
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
      if (!relay.ok) throw new Error(relayJson.error ?? 'Approval relay failed');
      setApproved(true);
      setStatus('Builder fee approved on SoDEX (spot+perps). You can revoke later with maxFeeRate 0.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitUserOrder() {
    if (!address || !accountId || !cfg || !confirmOrder || !feeAck) return;
    if (thesis.side === 'FLAT') {
      setError('FLAT thesis — nothing to submit');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const side = thesis.side === 'SHORT' ? 'sell' : 'buy';
      const prep = await fetch('/api/builder/prepare-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          accountId,
          network: cfg.network,
          symbol: thesis.symbol,
          side,
          type: 'limit',
          quantity: String(quantity),
          price: String(thesis.entry),
          confirmed: true,
        }),
      });
      const prepJson = (await prep.json()) as {
        error?: string;
        prepared?: {
          typedData: {
            domain: Record<string, unknown>;
            types: Record<string, Array<{ name: string; type: string }>>;
            primaryType: string;
            message: Record<string, unknown>;
          };
          params: Record<string, unknown>;
          nonce: string;
          network: 'mainnet' | 'testnet';
          feeDisclosure: { feeLabel: string; spotBuyNote: string };
          confirmSummary: Record<string, unknown>;
        };
      };
      if (!prep.ok || !prepJson.prepared) {
        throw new Error(prepJson.error ?? 'Prepare order failed');
      }
      setStatus(
        `Sign order · builder fee: ${prepJson.prepared.feeDisclosure.feeLabel}. ${prepJson.prepared.feeDisclosure.spotBuyNote}`,
      );
      const sig = await signTypedData(address, prepJson.prepared.typedData);
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
      const relayJson = (await relay.json()) as { error?: string; ok?: boolean };
      if (!relay.ok) throw new Error(relayJson.error ?? 'Order relay failed');
      setStatus('Order relayed to SoDEX with your signature. Check your wallet account for fills.');
      setConfirmOrder(false);
      setFeeAck(false);
      await loadCfg();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ padding: 22 }} aria-label="Builder Codes trading">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="badge" style={{ color: 'var(--accent-soft)', borderColor: 'rgba(255,79,32,0.35)' }}>
          Builder Codes
        </span>
        <span className={`badge ${cfg?.builderReady ? 'live' : 'fallback'}`}>
          {cfg?.builderReady ? `Builder ID set · ${cfg.network}` : 'Builder ID missing · dry-run / testnet'}
        </span>
        <span className={`badge ${cfg?.mainnetTradingEnabled ? 'live' : 'fallback'}`}>
          Mainnet kill switch: {cfg?.mainnetTradingEnabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <h3 style={{ margin: '0 0 8px', letterSpacing: '-0.02em' }}>Trade with your wallet</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', maxWidth: 62 * 8 }}>
        Non-custodial: you connect and sign. FlowSentinel never holds your keys and never places a
        mainnet order by itself. Builder fee (when configured):{' '}
        <strong style={{ color: 'var(--text)' }}>{cfg?.feeLabel ?? '—'}</strong>. Cap per order:{' '}
        {cfg?.maxNotionalUsdc ?? '—'} USDC.
      </p>

      {cfg?.notes?.length ? (
        <ul style={{ margin: '0 0 14px', paddingLeft: 18, color: 'var(--text-muted)', fontSize: 13 }}>
          {cfg.notes.map((n) => (
            <li key={n.slice(0, 48)}>{n}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void connect()}>
          {address ? 'Refresh wallet' : 'Connect wallet'}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={busy || !address || !accountId || !cfg?.builderId || approved}
          onClick={() => void approveBuilder()}
        >
          {approved ? 'Builder approved' : `Approve builder (max ${cfg?.maxApprovalLabel ?? '—'})`}
        </button>
      </div>

      {status ? (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text)' }} role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#f87171' }} role="alert">
          {error}
        </p>
      ) : null}

      <div
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 14,
          display: 'grid',
          gap: 10,
        }}
      >
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={feeAck}
            onChange={(e) => setFeeAck(e.target.checked)}
          />
          <span>
            I understand the builder fee is up to <strong>{cfg?.feeLabel ?? '—'}</strong> of eligible
            fill notional (subject to my approval and SoDEX caps), and that spot buys do not pay
            builder fees per SoDEX docs.
          </span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={confirmOrder}
            onChange={(e) => setConfirmOrder(e.target.checked)}
          />
          <span>
            I confirm this order ticket: {thesis.side} {thesis.symbol} qty≈{quantity.toPrecision(6)} @{' '}
            {thesis.entry} on <strong>{cfg?.network}</strong>. JARVIS/advisor never submits — only I
            do.
          </span>
        </label>
        <button
          className="btn btn-primary"
          type="button"
          disabled={
            busy ||
            !address ||
            !accountId ||
            !confirmOrder ||
            !feeAck ||
            thesis.side === 'FLAT' ||
            (cfg?.network === 'mainnet' && (!cfg.builderReady || !cfg.mainnetTradingEnabled))
          }
          onClick={() => void submitUserOrder()}
        >
          Sign &amp; relay order
        </button>
      </div>

      {cfg?.metrics ? (
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
          Race metrics (this deploy only): {cfg.metrics.ordersRouted} orders routed ·{' '}
          {cfg.metrics.uniqueWallets} unique wallets · {cfg.metrics.dryRuns} dry-runs.{' '}
          {cfg.metrics.note}
        </p>
      ) : null}
    </section>
  );
}
