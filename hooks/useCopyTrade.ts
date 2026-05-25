'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Network } from '@/types/sodex'
import { ENDPOINTS } from '@/lib/sodex'

export interface WsOrderUpdate {
  symbol:      string
  side:        1 | 2        // 1=buy 2=sell
  type:        number       // 1=limit 2=market ...
  price:       string
  quantity:    string
  status:      string       // "new" | "filled" | ...
  clOrdID:     string
  accountID:   number
}

export interface CopyTradeLog {
  id:        string
  ts:        number
  original:  WsOrderUpdate
  status:    'pending' | 'placed' | 'skipped' | 'error'
  message:   string
}

export interface CopyTradeConfig {
  targetAddress: string
  sizeMultiplier: number
  onlyBuys: boolean
  onlySells: boolean
  maxOrderUSDC: number
  network: Network
}

export function useCopyTrade(config: CopyTradeConfig | null) {
  const [logs,      setLogs]      = useState<CopyTradeLog[]>([])
  const [watching,  setWatching]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const wsRef     = useRef<WebSocket | null>(null)
  const pingTimer = useRef<ReturnType<typeof setInterval>>(undefined)
  const alive     = useRef(false)

  const addLog = useCallback((log: Omit<CopyTradeLog, 'id'>) => {
    const entry = { id: crypto.randomUUID(), ...log }
    setLogs(prev => [entry, ...prev].slice(0, 50))
  }, [])

  const connect = useCallback(() => {
    if (!config || !alive.current) return
    const ws = new WebSocket(ENDPOINTS[config.network].ws)
    wsRef.current = ws

    ws.onopen = () => {
      if (!alive.current) { ws.close(); return }
      setWatching(true); setError(null)
      ws.send(JSON.stringify({ op: 'subscribe', params: { channel: 'accountOrderUpdates', address: config.targetAddress } }))
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' }))
      }, 30_000)
    }

    ws.onmessage = async (event: MessageEvent) => {
      if (!alive.current) return
      let msg: any
      try { msg = JSON.parse(event.data as string) } catch { return }
      if (!msg || msg.op === 'pong') return
      const { channel, data } = msg
      if (channel !== 'accountOrderUpdates' || !data) return
      const order: WsOrderUpdate = data
      if (order.status !== 'new') return

      if (config.onlyBuys && order.side !== 1) return
      if (config.onlySells && order.side !== 2) return

      const copiedQty = parseFloat(order.quantity) * config.sizeMultiplier
      const notional = copiedQty * parseFloat(order.price)

      if (config.maxOrderUSDC > 0 && notional > config.maxOrderUSDC) {
        addLog({ ts: Date.now(), original: order, status: 'skipped', message: `Size $${notional.toFixed(2)} > Max $${config.maxOrderUSDC}` })
        return
      }

      addLog({ ts: Date.now(), original: order, status: 'pending', message: `Detected ${order.side === 1 ? 'BUY' : 'SELL'} ${copiedQty} ${order.symbol}` })
      window.dispatchEvent(new CustomEvent('sodex:copyorder', { detail: { ...order, quantity: copiedQty.toString() } }))
    }

    ws.onerror = () => { if (alive.current) setWatching(false); setError('WS Error') }
    ws.onclose = () => { if (alive.current) { setWatching(false); clearInterval(pingTimer.current); setTimeout(connect, 4000) } }
  }, [config, addLog])

  useEffect(() => {
    if (!config?.targetAddress) return
    alive.current = true; connect()
    return () => { alive.current = false; clearInterval(pingTimer.current); wsRef.current?.close(1000) }
  }, [config?.targetAddress, config?.network, connect])

  return { logs, watching, error, stop: () => { alive.current = false; wsRef.current?.close(1000); setWatching(false) }, clearLogs: () => setLogs([]) }
}
