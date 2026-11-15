'use client';
import React, { useId } from 'react';

/* Custom duotone icon set for the SoSwap Skills tab (orange gradient + white accent, 32x32 grid). */

type IconProps = { size?: number; className?: string };

function Svg({ size = 32, className, children, id }: IconProps & { children: (g: { o: string; w: string }) => React.ReactNode; id: string }) {
  const o = `${id}o`, w = `${id}w`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={o} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse"><stop stopColor="#fed7aa" /><stop offset=".45" stopColor="#fb923c" /><stop offset="1" stopColor="#c2410c" /></linearGradient>
        <linearGradient id={w} x1="8" y1="6" x2="26" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#ffffff" /><stop offset="1" stopColor="#a1a1aa" /></linearGradient>
      </defs>
      {children({ o: `url(#${o})`, w: `url(#${w})` })}
    </svg>
  );
}

/** Skills mark: a four-point spark inside an orbit, the tab's logo. */
export function SkillsMark(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <ellipse cx="16" cy="16" rx="13" ry="5.2" transform="rotate(-28 16 16)" stroke={o} strokeWidth="1.6" opacity=".75" />
        <path d="M16 3.5c.9 6.4 3.1 8.6 9.5 9.5-6.4.9-8.6 3.1-9.5 9.5-.9-6.4-3.1-8.6-9.5-9.5 6.4-.9 8.6-3.1 9.5-9.5Z" fill={o} />
        <path d="M16 9.5c.5 3.2 1.8 4.5 5 5-3.2.5-4.5 1.8-5 5-.5-3.2-1.8-4.5-5-5 3.2-.5 4.5-1.8 5-5Z" fill={w} />
        <circle cx="26.2" cy="22.8" r="1.7" fill={o} />
      </>
    )}</Svg>
  );
}

/** Trade Check: shield with a scan line and a tick. */
export function TradeCheckIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <path d="M16 3 26 7v8c0 6.2-4.2 11.2-10 14C10.2 26.200 6 21.200 6 15V7l10-4Z" fill={o} opacity=".4" stroke={o} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10.500 15.500 14.500 19.500 22 11.500" stroke={w} strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 24.500h14" stroke={o} strokeWidth="1.600" strokeLinecap="round" strokeDasharray="1 3" />
      </>
    )}</Svg>
  );
}

/** Position Size: risk gauge (arc with needle and stop marker). */
export function PositionIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <path d="M4.500 22A11.500 11.500 0 0 1 27.500 22" stroke={o} strokeWidth="3.400" strokeLinecap="round" opacity=".3" />
        <path d="M4.500 22A11.500 11.500 0 0 1 14 10.600" stroke={o} strokeWidth="3.400" strokeLinecap="round" />
        <path d="M16 22 22.500 13" stroke={w} strokeWidth="2.600" strokeLinecap="round" />
        <circle cx="16" cy="22" r="2.800" fill={w} />
        <path d="M5 28h22" stroke={o} strokeWidth="1.800" strokeLinecap="round" />
      </>
    )}</Svg>
  );
}

/** Portfolio: segmented donut. */
export function PortfolioIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <circle cx="16" cy="16" r="9.500" stroke={o} strokeWidth="6" strokeDasharray="34 26" strokeLinecap="butt" transform="rotate(-90 16 16)" />
        <circle cx="16" cy="16" r="9.500" stroke={w} strokeWidth="6" strokeDasharray="15 45" strokeDashoffset="-35" transform="rotate(-90 16 16)" />
        <circle cx="16" cy="16" r="9.500" stroke={o} strokeWidth="6" strokeDasharray="8 52" strokeDashoffset="-51" opacity=".4" transform="rotate(-90 16 16)" />
        <circle cx="16" cy="16" r="3" fill={o} opacity=".9" />
      </>
    )}</Svg>
  );
}

/** Market Brief: candlesticks with a trend line. */
export function BriefIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <path d="M8 6v20M16 9v15M24 4v18" stroke={o} strokeWidth="1.600" strokeLinecap="round" opacity=".7" />
        <rect x="5.500" y="11" width="5" height="9" rx="1.200" fill={o} />
        <rect x="13.500" y="14" width="5" height="7" rx="1.200" fill={w} />
        <rect x="21.500" y="8" width="5" height="10" rx="1.200" fill={o} />
        <path d="M3.500 25.500 11 19l6 3 11-12" stroke={w} strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
      </>
    )}</Svg>
  );
}

/** News Impact: newspaper with a bolt. */
export function NewsIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <rect x="4.500" y="6" width="23" height="20" rx="3.500" fill={o} opacity=".2" stroke={o} strokeWidth="1.800" />
        <path d="M9 11h8M9 15h5M9 19h6" stroke={w} strokeWidth="1.800" strokeLinecap="round" />
        <path d="M23 9.500 18.800 16h3.600l-1.600 6.500 5-7.300h-3.700L23 9.500Z" fill={o} stroke={o} strokeWidth=".8" strokeLinejoin="round" />
      </>
    )}</Svg>
  );
}

/** Plan Review: clipboard with checklist. */
export function PlanIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <rect x="6" y="5.500" width="20" height="23" rx="3.500" fill={o} opacity=".2" stroke={o} strokeWidth="1.800" />
        <rect x="11.500" y="3" width="9" height="5.500" rx="2" fill={o} />
        <path d="m9.800 14.200 1.700 1.700 3-3.200M9.800 21l1.700 1.700 3-3.200" stroke={w} strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17.500 14.500h5M17.500 21.300h5" stroke={o} strokeWidth="1.800" strokeLinecap="round" />
      </>
    )}</Svg>
  );
}

/** Rounded tile that frames a skill icon. */
export function SkillTile({ children, size = 44, active = false }: { children: React.ReactNode; size?: number; active?: boolean }) {
  return (
    <span style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-2xl border ${active ? 'border-orange-500/60 bg-gradient-to-br from-orange-500/25 to-orange-700/5 shadow-[0_0_18px_rgba(249,115,22,0.35)]' : 'border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.01]'}`}>
      {children}
    </span>
  );
}

/** Journal: notebook with a rising line. */
export function JournalIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <rect x="6" y="4" width="20" height="24" rx="3.500" fill={o} opacity=".3" stroke={o} strokeWidth="1.800" />
        <path d="M6 9h-2M6 15H4M6 21H4" stroke={o} strokeWidth="1.800" strokeLinecap="round" />
        <path d="m10.500 21 4-4.500 3 2.500 5-6.500" stroke={w} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.500" cy="12.500" r="1.700" fill={w} />
      </>
    )}</Svg>
  );
}

/** Alerts: bell with a signal arc. */
export function AlertIcon(p: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg {...p} id={id}>{({ o, w }) => (
      <>
        <path d="M16 4.500c-4.800 0-7.500 3.400-7.500 8v4.300L6 21.500h20l-2.500-4.700V12.500c0-4.600-2.700-8-7.500-8Z" fill={o} opacity=".4" stroke={o} strokeWidth="1.800" strokeLinejoin="round" />
        <path d="M13 25.500a3.200 3.200 0 0 0 6 0" stroke={w} strokeWidth="2" strokeLinecap="round" />
        <path d="M24.500 6.500a8 8 0 0 1 2.500 4M7.500 6.500A8 8 0 0 0 5 10.500" stroke={w} strokeWidth="1.600" strokeLinecap="round" />
      </>
    )}</Svg>
  );
}
