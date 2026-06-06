import { create } from 'zustand';
import type { Ticker, OrderBook } from '@/types/sodex';

interface SodexState {
  tickers: Map<string, Ticker>;
  tickerList: Ticker[];
  orderBook: OrderBook | null;
  connected: boolean;
  error: string | null;
  
  // Actions
  setTickers: (updater: (prev: Map<string, Ticker>) => Map<string, Ticker>) => void;
  setOrderBook: (orderBook: OrderBook | null) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSodexStore = create<SodexState>((set) => ({
  tickers: new Map(),
  tickerList: [],
  orderBook: null,
  connected: false,
  error: null,
  
  setTickers: (updater) => set((state) => {
    const newTickers = updater(state.tickers);
    return { tickers: newTickers, tickerList: Array.from(newTickers.values()) };
  }),
  setOrderBook: (orderBook) => set({ orderBook }),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
}));
