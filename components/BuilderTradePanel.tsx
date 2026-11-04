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
  appFeePercent: string;
  maxApprovalPercent: string;
  builderFee: number;
  maxApproval: number;
  maxNotionalUsdc: number;
  mode: 'live' | 'practice';
  tradingLive: boolean;
  builderReady: boolean;
  feeLine: string;
  feeDisclosure?: {
    perpsBothSides: string;
    spotBuyExempt: string;
    caps: string;
  };
  realFundsWarning: string | null;
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
        throw new Error('No browser wallet found. Install one to continue.');
      }
      const addr = await connectInjectedWallet();
      setAddress(addr);
      const net = cfg?.tradingLive ? 'mainnet' : 'testnet';
      const acc = await fetch(
        `/api/builder/account?address=${encodeURIComponent(addr)}&network=${net}`,
      );
      const json = (await acc.json()) as {
        accountId?: number | null;
        error?: string;
        builders?: { data?: { spot?: Array<{ builderID: number }> } };
      };
      if (!acc.ok) throw new Error(json.error ?? 'Could not load your account.');
      setAccountId(json.accountId ?? null);
      const ours = cfg?.builderId;
      const spot =
        json.builders && typeof json.builders === 'object'
          ? (json.builders as { data?: { spot?: Array<{ builderID: number }> } }).data
              ?.spot
          : undefined;
      if (ours && Array.isArray(spot) && spot.some((b) => b.builderID === ours)) {
        setApproved(true);
      }
      setStatus(
        json.accountId
          ? `Connected ${addr.slice(0, 6)}…${addr.slice(-4)}`
          : `Connected ${addr.slice(0, 6)}…${addr.slice(-4)}. Activate your SoDEX account to trade.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect wallet.');
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
          network: cfg.tradingLive ? 'mainnet' : 'testnet',
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
        };
        disclosure?: { maxFeeLabel?: string; note?: string };
      };
      if (!prep.ok || !prepJson.prepared) {
        throw new Error(prepJson.error ?? 'Could not prepare fee approval.');
      }
      setStatus(
        `Approve up to ${cfg.maxApprovalPercent} app fee in your wallet…`,
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
      if (!relay.ok) throw new Error(relayJson.error ?? 'Approval failed.');
      setApproved(true);
      setStatus('App fee approved. You can revoke it later from your SoDEX account.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitUserOrder() {
    if (!address || !accountId || !cfg || !confirmOrder || !feeAck) return;
    if (thesis.side === 'FLAT') {
      setError('Nothing to submit for a flat thesis.');
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
          network: cfg.tradingLive ? 'mainnet' : 'testnet',
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
        };
        practiceOnly?: boolean;
      };
      if (!prep.ok || !prepJson.prepared) {
        throw new Error(prepJson.error ?? 'Could not prepare the order.');
      }
      setStatus(
        `Sign order · ${prepJson.prepared.feeDisclosure.feeLabel}. ${prepJson.prepared.feeDisclosure.spotBuyNote}`,
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
      if (!relay.ok) throw new Error(relayJson.error ?? 'Order failed.');
      setStatus(
        prepJson.practiceOnly
          ? 'Practice order submitted. Check your SoDEX account for status.'
          : 'Order submitted. Check your SoDEX account for fills.',
      );
      setConfirmOrder(false);
      setFeeAck(false);
      await loadCfg();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed.');
    } finally {
      setBusy(false);
    }
  }

  const modeLabel = cfg?.tradingLive ? 'Live' : 'Practice';

  return (
    <section className="panel" style={{ padding: 22 }} aria-label="Trade with your wallet">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="badge" style={{ color: 'var(--accent-soft)', borderColor: 'rgba(255,79,32,0.35)' }}>
          Wallet trade
        </span>
        <span className={`badge ${cfg?.tradingLive ? 'live' : 'fallback'}`}>{modeLabel}</span>
        {cfg?.feeLine ? <span className="badge">{cfg.feeLine}</span> : null}
      </div>
      <h3 style={{ margin: '0 0 8px', letterSpacing: '-0.02em' }}>Trade with your wallet</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', maxWidth: 62 * 8 }}>
        Non-custodial: you connect and sign. FlowSentinel never holds your keys.
        Cap per order: {cfg?.maxNotionalUsdc ?? '—'} USDC.
      </p>

      {cfg?.feeDisclosure ? (
        <div
          className="panel"
          style={{
            margin: '0 0 14px',
            padding: 12,
            fontSize: 13,
            color: 'var(--text-muted)',
            display: 'grid',
            gap: 6,
          }}
        >
          <strong style={{ color: 'var(--text)' }}>{cfg.feeDisclosure.caps}</strong>
          <span>{cfg.feeDisclosure.perpsBothSides}</span>
          <span>{cfg.feeDisclosure.spotBuyExempt}</span>
        </div>
      ) : null}

      {cfg?.realFundsWarning ? (
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#fbbf24' }} role="status">
          {cfg.realFundsWarning}
        </p>
      ) : (
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
          Practice mode uses the SoDEX practice network. No live funds move from this panel until live
          trading is turned on.
        </p>
      )}

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
          {approved ? 'App fee approved' : `Approve app fee (max ${cfg?.maxApprovalPercent ?? '—'})`}
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
          <input type="checkbox" checked={feeAck} onChange={(e) => setFeeAck(e.target.checked)} />
          <span>
            I understand this {cfg?.feeLine ?? 'Includes an app fee'}. Spot buys pay no app fee. Perps
            can charge on both sides.
          </span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={confirmOrder}
            onChange={(e) => setConfirmOrder(e.target.checked)}
          />
          <span>
            I confirm this order: {thesis.side} {thesis.symbol} qty≈{quantity.toPrecision(6)} @{' '}
            {thesis.entry} ({modeLabel}). Only I submit — the advisor never does.
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
            !cfg?.builderReady
          }
          onClick={() => void submitUserOrder()}
        >
          Sign and submit order
        </button>
      </div>
    </section>
  );
}
