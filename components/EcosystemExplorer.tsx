'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, BarChart3, Blocks, Gift, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

type Destination = 'markets' | 'swap' | 'wealth' | 'skills';
type Pathway = {
  id: Destination;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  icon: typeof BarChart3;
  accent: string;
  action: string;
};

const pathways: Pathway[] = [
  {
    id: 'markets', eyebrow: 'DISCOVER', title: 'Explore what’s moving',
    description: 'Find live SoDEX markets and follow the stories behind them.',
    detail: 'Start with live market data, news, and sector context in one place.',
    icon: BarChart3, accent: 'text-sky-300', action: 'Explore markets',
  },
  {
    id: 'swap', eyebrow: 'TRADE', title: 'Make your next move',
    description: 'Compare a route, review costs, then sign with your wallet.',
    detail: 'Preview the route and estimated costs before you approve anything.',
    icon: ShieldCheck, accent: 'text-orange-300', action: 'Open swap',
  },
  {
    id: 'wealth', eyebrow: 'EARN', title: 'See your SoDEX rewards',
    description: 'Connect your wallet to check points and eligible Blind Boxes.',
    detail: 'Wallet verification unlocks your live SoPoints and reward status.',
    icon: Gift, accent: 'text-amber-300', action: 'Visit Wealth',
  },
  {
    id: 'skills', eyebrow: 'BUILD', title: 'Create with the ecosystem',
    description: 'Explore strategy tools and builder-friendly product ideas.',
    detail: 'See the tools already in SoSwapDEX and discover ways to build on SoDEX.',
    icon: Blocks, accent: 'text-violet-300', action: 'Explore tools',
  },
];

export default function EcosystemExplorer({ onNavigate }: { onNavigate: (destination: Destination) => void }) {
  const [activeId, setActiveId] = useState<Destination>('markets');
  const reduceMotion = useReducedMotion();
  const active = pathways.find((pathway) => pathway.id === activeId) ?? pathways[0];
  const Icon = active.icon;

  return (
    <section className="mt-8 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(ellipse_at_100%_0%,rgba(249,115,22,.12),transparent_42%),linear-gradient(145deg,#111114,#0a0a0c_78%)] p-5 sm:p-7" aria-labelledby="ecosystem-explorer-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[.2em] text-orange-300">ONE ECOSYSTEM, YOUR NEXT MOVE</span>
          <h2 id="ecosystem-explorer-title" className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">Where do you want to go?</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Move from discovery to action, or find the tools to build something new.</p>
        </div>
        <span className="hidden rounded-full border border-white/[0.08] px-3 py-1.5 text-[11px] text-zinc-500 sm:inline-flex">Explore · Trade · Earn · Build</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Choose an area to explore">
        {pathways.map((pathway, index) => {
          const PathIcon = pathway.icon;
          const selected = activeId === pathway.id;
          return (
            <motion.button
              key={pathway.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveId(pathway.id)}
              onFocus={() => setActiveId(pathway.id)}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : index * 0.055 }}
              className={`group min-h-[158px] rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${selected ? 'border-orange-300/45 bg-orange-300/[0.07]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]'}`}
            >
              <span className="flex items-center justify-between">
                <span className={`grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-black/20 ${pathway.accent}`}><PathIcon className="size-[18px]" aria-hidden="true" /></span>
                <span className={`text-[9px] font-bold tracking-[.17em] ${selected ? 'text-orange-200' : 'text-zinc-600'}`}>{pathway.eyebrow}</span>
              </span>
              <span className="mt-4 block text-sm font-semibold text-zinc-100">{pathway.title}</span>
              <span className="mt-1.5 block text-xs leading-5 text-zinc-500">{pathway.description}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active.id}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3.5"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <Icon className={`mt-0.5 size-4 shrink-0 ${active.accent}`} aria-hidden="true" />
            <div><p className="text-sm font-medium text-zinc-200">{active.detail}</p><p className="mt-1 text-[11px] text-zinc-600">Choose a space to preview it, then continue when you’re ready.</p></div>
          </div>
          <button type="button" onClick={() => onNavigate(active.id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-semibold text-white transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c]">
            {active.action}<ArrowUpRight className="size-3.5" aria-hidden="true" />
          </button>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
