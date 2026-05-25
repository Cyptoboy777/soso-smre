'use client';
// SodexPriceBridge — mounts once in AppShell, runs silently in background.
// Connects to SoDEX WebSocket, receives allTicker, pushes to /api/sodex-cache
// every 10s so server-side /api/prices can serve SoDEX data.

import { useEffect, useRef } from 'react';

const SODEX_WS = 'wss://mainnet-gw.sodex.dev/ws/spot';
const PUSH_INTERVAL_MS = 10_000; // push to cache every 10s

export default function SodexPriceBridge() {
  const ws        = useRef<WebSocket | null>(null);
  const tickers   = useRef<Map<string, any>>(new Map());
  const pingTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const pushTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const alive     = useRef(true);

  useEffect(() => {
    alive.current = true;

    function connect() {
      if (!alive.current) return;
      const socket = new WebSocket(SODEX_WS);
      ws.current = socket;

      socket.onopen = () => {
        if (!alive.current) { socket.close(); return; }
        // Subscribe to all tickers
        socket.send(JSON.stringify({ op: 'subscribe', params: { channel: 'allTicker' } }));

        // Ping every 30s to keep connection alive
        pingTimer.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ op: 'ping' }));
          }
        }, 30_000);

        // Push ticker data to server cache every 10s
        pushTimer.current = setInterval(() => {
          if (tickers.current.size === 0) return;
          const tickerArray = Array.from(tickers.current.values());
          fetch('/api/sodex-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: tickerArray }),
          }).catch(() => {}); // silent fail — bridge is best-effort
        }, PUSH_INTERVAL_MS);
      };

      socket.onmessage = (event: MessageEvent) => {
        if (!alive.current) return;
        let msg: any;
        try { msg = JSON.parse(event.data as string); } catch { return; }
        if (!msg || msg.op === 'pong') return;
        if (msg.channel === 'allTicker' && Array.isArray(msg.data)) {
          for (const raw of msg.data) {
            if (!raw?.s) continue;
            // SoDEX format: "vBTC_vUSDC" — split by _ and strip v prefix
            const parts = (raw.s as string).split('_');
            const rawBase  = parts[0] ?? '';
            const rawQuote = parts[1] ?? '';
            const base  = rawBase.startsWith('v')  ? rawBase.slice(1)  : rawBase;
            const quote = rawQuote.startsWith('v') ? rawQuote.slice(1) : rawQuote;
            const bid = parseFloat(raw.b) || 0;
            const ask = parseFloat(raw.a) || 0;
            tickers.current.set(raw.s, {
              symbol: raw.s, base, quote,
              lastPrice:     parseFloat(raw.c) || 0,
              priceChange:   parseFloat(raw.p) || 0,
              priceChangePct: raw.P ?? 0,
              high:          parseFloat(raw.h) || 0,
              low:           parseFloat(raw.l) || 0,
              open:          parseFloat(raw.o) || 0,
              baseVolume:    parseFloat(raw.v) || 0,
              quoteVolume:   parseFloat(raw.q) || 0,
              bestBid: bid, bestAsk: ask,
              spread: ask > 0 && bid > 0 ? ask - bid : 0,
              updatedAt: raw.E ?? Date.now(),
            });
          }
        }
      };

      socket.onerror = () => { if (alive.current) setTimeout(connect, 5_000); };
      socket.onclose = (ev) => {
        clearInterval(pingTimer.current);
        clearInterval(pushTimer.current);
        if (alive.current && ev.code !== 1000) setTimeout(connect, 5_000);
      };
    }

    connect();

    return () => {
      alive.current = false;
      clearInterval(pingTimer.current);
      clearInterval(pushTimer.current);
      ws.current?.close(1000);
    };
  }, []);

  // Renders nothing — pure background bridge
  return null;
}
