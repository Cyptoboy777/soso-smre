'use client'
import { useEffect, useRef, useCallback } from 'react'
import { normaliseTicker, normaliseL2Book, ENDPOINTS } from '@/lib/sodex'
import type { Network } from '@/types/sodex'
import { useSodexStore } from '@/store/sodexStore'

export interface SodexWSState {
  subscribeBook:   (symbol: string) => void
  unsubscribeBook: (symbol: string) => void
}

export function useSodexWS(network: Network = 'mainnet'): SodexWSState {
  const setTickers = useSodexStore(state => state.setTickers)
  const setOrderBook = useSodexStore(state => state.setOrderBook)
  const setConnected = useSodexStore(state => state.setConnected)
  const setError = useSodexStore(state => state.setError)

  const wsRef          = useRef<WebSocket | null>(null)
  const pingTimer      = useRef<ReturnType<typeof setInterval>>(undefined)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const bookSymbol     = useRef<string | null>(null)
  const alive          = useRef(true)
  const wsUrl          = ENDPOINTS[network].ws

  const send = useCallback((msg: object) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const subscribeBook = useCallback((symbol: string) => {
    if (bookSymbol.current && bookSymbol.current !== symbol) {
      send({ op: 'unsubscribe', params: { channel: 'l2Book', symbol: bookSymbol.current } })
    }
    bookSymbol.current = symbol
    setOrderBook(null)
    send({ op: 'subscribe', params: { channel: 'l2Book', symbol } })
  }, [send])

  const unsubscribeBook = useCallback((symbol: string) => {
    send({ op: 'unsubscribe', params: { channel: 'l2Book', symbol } })
    bookSymbol.current = null
    setOrderBook(null)
  }, [send])

  const connect = useCallback(() => {
    if (!alive.current) return
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!alive.current) { ws.close(); return }
      setConnected(true)
      setError(null)
      ws.send(JSON.stringify({ op: 'subscribe', params: { channel: 'allTicker' } }))
      if (bookSymbol.current) {
        ws.send(JSON.stringify({ op: 'subscribe', params: { channel: 'l2Book', symbol: bookSymbol.current } }))
      }
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' }))
      }, 30_000)
    }

    ws.onmessage = (event: MessageEvent) => {
      if (!alive.current) return
      let msg: any
      try { msg = JSON.parse(event.data as string) } catch { return }
      if (!msg || msg.op === 'pong') return
      const { channel, data } = msg
      if (channel === 'allTicker' && Array.isArray(data)) {
        setTickers(prev => {
          const next = new Map(prev)
          for (const raw of data) if (raw?.s) next.set(raw.s, normaliseTicker(raw))
          return next
        })
      }
      if (channel === 'l2Book' && data) {
        setOrderBook(normaliseL2Book(data))
      }
    }

    ws.onerror = () => { if (alive.current) { setConnected(false); setError('WebSocket error') } }
    ws.onclose = (ev) => {
      if (!alive.current) return
      setConnected(false)
      clearInterval(pingTimer.current)
      if (ev.code !== 1000) reconnectTimer.current = setTimeout(connect, 3_000)
    }
  }, [wsUrl])

  useEffect(() => {
    alive.current = true
    connect()
    return () => {
      alive.current = false
      clearInterval(pingTimer.current)
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close(1000)
    }
  }, [connect])

  return { subscribeBook, unsubscribeBook }
}
