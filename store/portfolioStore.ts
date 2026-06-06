import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Position, ExecutedOrder } from '@/types/sodex';

interface PortfolioState {
  positions: Position[];
  orders: ExecutedOrder[];
  paperCapital: number;
  dailyPnL: number;
  
  // Actions
  addPosition: (pos: Position) => void;
  removePosition: (id: string) => void;
  addOrder: (order: ExecutedOrder) => void;
  setPaperCapital: (amount: number) => void;
  addDailyPnL: (amount: number) => void;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      positions: [],
      orders: [],
      paperCapital: 100000,
      dailyPnL: 250,
      
      addPosition: (pos) => set((state) => ({ positions: [...state.positions, pos] })),
      removePosition: (id) => set((state) => ({ positions: state.positions.filter(p => p.id !== id) })),
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      setPaperCapital: (amount) => set({ paperCapital: amount }),
      addDailyPnL: (amount) => set((state) => ({ dailyPnL: state.dailyPnL + amount })),
    }),
    {
      name: 'sodex-portfolio-storage',
    }
  )
);
