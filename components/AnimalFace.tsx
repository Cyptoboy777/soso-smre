'use client';
import React, { useId } from 'react';

/** 'orb' is the plain SoSwap AI helmet-orb; the others add an animal's ears / horns and a little nose + mouth to it. */
export type AnimalKind = 'orb' | 'dog' | 'fox' | 'cat' | 'bear' | 'bull' | 'owl';
export const ANIMALS: { kind: AnimalKind; label: string; vibe: string }[] = [
  { kind: 'orb', label: 'SoSwap orb', vibe: 'Classic' },
  { kind: 'dog', label: 'Dog', vibe: 'Loyal' },
  { kind: 'fox', label: 'Fox', vibe: 'Quick & clever' },
  { kind: 'cat', label: 'Cat', vibe: 'Curious' },
  { kind: 'bear', label: 'Bear', vibe: 'Cautious' },
  { kind: 'bull', label: 'Bull', vibe: 'Optimistic' },
  { kind: 'owl', label: 'Owl', vibe: 'Wise' },
];

export type Expression = 'happy' | 'talk' | 'wink' | 'angry';
const OR = '#ff8a1f';
const mirror = (n: React.ReactNode) => <g transform="translate(200 0) scale(-1 1)">{n}</g>;

/** Ears / horns sit behind the shell so they look attached to it. `a` = silver gradient, `g` = orange glow gradient. */
function Accessories({ kind, a, g }: { kind: AnimalKind; a: string; g: string }) {
  const rim = { stroke: 'rgba(255,255,255,.7)', strokeWidth: 1 } as const;
  const side = (n: React.ReactNode) => <g className="ao-ears"><g>{n}</g>{mirror(n)}</g>;
  switch (kind) {
    case 'dog':
      return side(<><path d="M52 66C32 56 17 84 26 120c6 14 22 8 25-10 3-14 2-28 9-38z" fill={`url(#${a})`} {...rim} /><path d="M46 78C36 76 31 94 35 110c3 6 9 3 10-5 1-9 0-19 3-27z" fill={`url(#${g})`} opacity=".85" /></>);
    case 'fox':
      return side(<><path d="M56 60 46 10 96 42z" fill={`url(#${a})`} {...rim} /><path d="M58 52 54 24 82 43z" fill={`url(#${g})`} opacity=".9" /></>);
    case 'cat':
      return side(<><path d="M54 62 48 12 94 42z" fill={`url(#${a})`} {...rim} /><path d="M57 54 53 26 80 44z" fill="#ff9aa8" opacity=".9" /></>);
    case 'bear':
      return side(<><circle cx="54" cy="46" r="17" fill={`url(#${a})`} {...rim} /><circle cx="54" cy="46" r="8.500" fill={`url(#${g})`} opacity=".9" /></>);
    case 'bull':
      return side(<><path d="M58 62C36 62 20 44 26 16c12 18 30 24 50 26z" fill="#fff3d6" stroke="#d9bf8a" strokeWidth="1" /><ellipse cx="38" cy="96" rx="15" ry="8" transform="rotate(-22 38 96)" fill={`url(#${a})`} {...rim} /></>);
    case 'owl':
      return side(<><path d="M60 56 48 14 96 42z" fill={`url(#${a})`} {...rim} /><path d="M62 50 56 28 82 44z" fill={`url(#${g})`} opacity=".9" /></>);
    default:
      return null;
  }
}


/** Glowing eyes. Each expression pops in with a tiny scale animation (see .ao-pop). */
function Eyes({ expr, round }: { expr: Expression; round: boolean }) {
  const oval = <ellipse rx="6" ry="10.500" fill={OR} />;
  const shape = (side: 0 | 1) => {
    const f = side === 1 ? -1 : 1;
    switch (expr) {
      case 'talk': return oval;
      case 'wink': return side === 0 ? oval : <path d="M-9 -9 6 0 -9 9" fill="none" stroke={OR} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />;
      case 'angry': return <path d={`M${-13 * f} -7 ${12 * f} 5`} fill="none" stroke={OR} strokeWidth="7.500" strokeLinecap="round" />;
      default:
        return round
          ? <><circle r="9.500" fill={OR} /><circle r="4.200" fill="#2a1204" /><circle cx="2" cy="-2" r="1.500" fill="#fff" /></>
          : <><path d="M-14 6Q0-12 14 6" fill="none" stroke={OR} strokeWidth="6.500" strokeLinecap="round" /><path d="M-14 6Q0-12 14 6" fill="none" stroke="#ffd9a3" strokeWidth="1.800" strokeLinecap="round" opacity=".85" /></>;
    }
  };
  return (
    <g className="ao-eyes">
      {[80, 120].map((x, i) => (
        <g key={x} transform={`translate(${x} ${expr === 'happy' ? 88 : 92})`}><g className="ao-eye"><g key={expr} className="ao-pop ao-glow">{shape(i as 0 | 1)}</g></g></g>
      ))}
    </g>
  );
}

/** Glowing nose / mouth drawn on the dark visor (none for the classic orb, like the reference). */
function Features({ kind }: { kind: AnimalKind }) {
  const line = { stroke: OR, strokeWidth: 2.4, strokeLinecap: 'round', fill: 'none' } as const;
  switch (kind) {
    case 'dog':
      return (<g className="ao-glow"><ellipse cx="100" cy="106" rx="5.500" ry="4" fill={OR} /><g className="ao-mouth"><path d="M100 110v5M100 115q-6 6-12 1M100 115q6 6 12 1" {...line} /></g><ellipse className="ao-tongue" cx="100" cy="124" rx="3.800" ry="4.500" fill="#ff7a9a" /></g>);
    case 'fox':
      return (<g className="ao-glow"><path d="M95.500 104h9L100 110z" fill={OR} /><g className="ao-mouth"><path d="M100 110q-5 6-10 2M100 110q5 6 10 2" {...line} /></g></g>);
    case 'cat':
      return (<g className="ao-glow"><path d="M96 104h8l-4 5z" fill="#ff8aa0" /><g className="ao-mouth"><path d="M100 109q-5 6-10 2M100 109q5 6 10 2" {...line} /></g><path d="M80 108 56 104M80 113 56 117M120 108l24-4M120 113l24 4" stroke="rgba(255,190,120,.8)" strokeWidth="1.300" strokeLinecap="round" /></g>);
    case 'bear':
      return (<g className="ao-glow"><ellipse cx="100" cy="106" rx="6" ry="4.400" fill={OR} /><g className="ao-mouth"><path d="M100 110v3M100 113q-5 5-9 1M100 113q5 5 9 1" {...line} /></g></g>);
    case 'bull':
      return (<g className="ao-glow"><ellipse cx="91" cy="108" rx="2.600" ry="3.600" fill={OR} /><ellipse cx="109" cy="108" rx="2.600" ry="3.600" fill={OR} /><path d="M90 118Q100 134 110 118" stroke="#ffd24a" strokeWidth="2.200" strokeLinecap="round" fill="none" /><g className="ao-mouth"><path d="M92 114q8 4 16 0" {...line} strokeWidth={1.800} /></g></g>);
    case 'owl':
      return (<g className="ao-glow"><path className="ao-mouth" d="M95 103h10l-5 12z" fill="#ffb21a" /></g>);
    default:
      return null;
  }
}

/**
 * Animated SoSwap AI orb: silver helmet, black glass visor with glowing eyes, orbiting light rings, sparkles and,
 * with `stage`, a glowing platform + name plate. Eyes blink and drift; `talking` bounces the eyes, speeds the rings
 * and moves the mouth. Everything stops under prefers-reduced-motion.
 */
export default function AnimalOrb({ kind, talking = false, compact = false, size, still = false, stage = false, expression }: { kind: AnimalKind; talking?: boolean; compact?: boolean; size?: number; still?: boolean; stage?: boolean; expression?: Expression }) {
  const expr: Expression = expression ?? (talking ? 'talk' : 'happy');
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${uid}${n}`;
  const url = (n: string) => `url(#${id(n)})`;
  const round = kind === 'owl';
  const detail = stage;            // name plate text only when large enough to read
  const viewBox = stage ? '0 0 200 230' : '14 14 172 172';

  return (
    <div className={`ss-orb ss-orb--v2 ${compact ? 'ss-orb--compact' : ''} ${still ? 'ss-orb--still' : ''} ${talking ? 'ss-orb--talk' : ''} ${stage ? 'ss-orb--stage' : ''}`} style={size ? { width: size, height: size } : undefined} role="img" aria-label={`${kind === 'orb' ? 'SoSwap AI' : kind} bot`}>
      <svg viewBox={viewBox} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id={id('shell')} cx=".34" cy=".24" r=".95"><stop offset="0" stopColor="#ffffff" /><stop offset=".38" stopColor="#d9d9de" /><stop offset=".78" stopColor="#8b8b93" /><stop offset="1" stopColor="#4b4b52" /></radialGradient>
          <radialGradient id={id('glass')} cx=".3" cy=".18" r="1"><stop offset="0" stopColor="#34343a" /><stop offset=".25" stopColor="#101013" /><stop offset="1" stopColor="#000" /></radialGradient>
          <linearGradient id={id('acc')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5f5f7" /><stop offset="1" stopColor="#8f8f97" /></linearGradient>
          <linearGradient id={id('glow')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb457" /><stop offset="1" stopColor="#e8620a" /></linearGradient>
          <linearGradient id={id('orbit')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff7a00" /><stop offset=".5" stopColor="#ffc27a" /><stop offset="1" stopColor="#ff7a00" /></linearGradient>
          <radialGradient id={id('floor')} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ff8a1f" stopOpacity=".55" /><stop offset="1" stopColor="#ff8a1f" stopOpacity="0" /></radialGradient>
          <linearGradient id={id('so')} x1="12" y1="6" x2="52" y2="34" gradientUnits="userSpaceOnUse"><stop stopColor="#fdba74" /><stop offset=".5" stopColor="#fb923c" /><stop offset="1" stopColor="#ea580c" /></linearGradient>
          <linearGradient id={id('sw')} x1="52" y1="30" x2="12" y2="60" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset="1" stopColor="#a1a1aa" /></linearGradient>
          <clipPath id={id('clip')}><circle cx="100" cy="100" r="62" /></clipPath>
        </defs>

        {stage && (
          <g className="ao-floor" aria-hidden>
            <ellipse cx="100" cy="196" rx="96" ry="20" fill={url('floor')} opacity="1" />
            {[78, 60, 43, 27].map((rx, i) => <ellipse key={rx} cx="100" cy="196" rx={rx} ry={rx * 0.17} fill="none" stroke={OR} strokeWidth={i === 0 ? 1.4 : 1} opacity={0.35 + i * 0.12} />)}
            {[0, 1, 2].map((i) => <ellipse key={`r${i}`} className="ao-ripple" style={{ animationDelay: `${i * 1.1}s` }} cx="100" cy="196" rx="80" ry="13.600" fill="none" stroke="#ffb457" strokeWidth="1.600" />)}
          </g>
        )}

        <g className="ao-bob">
          {/* back half of the orbit rings */}
          <g transform="rotate(-16 100 100)" className="ao-ring" aria-hidden>
            <path d="M8 100A92 28 0 0 1 192 100" fill="none" stroke={OR} strokeOpacity=".25" strokeWidth="1.500" />
            <path className="ao-flow" pathLength={100} d="M8 100A92 28 0 0 1 192 100" fill="none" stroke={url('orbit')} strokeWidth="3.200" strokeLinecap="round" strokeDasharray="26 74" />
          </g>

          <g transform="rotate(24 100 100)" className="ao-ring ao-ring--thin" aria-hidden>
            <path className="ao-flow ao-flow--rev" pathLength={100} d="M14 100A86 24 0 0 1 186 100" fill="none" stroke="#ffe2bd" strokeOpacity=".85" strokeWidth="1.400" strokeLinecap="round" strokeDasharray="22 78" />
          </g>

          <g className="ao-head">
          <Accessories kind={kind} a={id('acc')} g={id('glow')} />

          {/* helmet shell */}
          <circle cx="100" cy="100" r="62" fill={url('shell')} stroke="rgba(255,255,255,.75)" strokeWidth="1.200" />
          <g clipPath={url('clip')}>
            <path d="M30 124Q100 150 170 124V190H30z" fill="#0b0b0d" />
            <path d="M30 124Q100 150 170 124" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
          </g>
          {/* visor */}
          <ellipse cx="100" cy="90" rx="49" ry="44" fill={url('glass')} stroke={OR} strokeOpacity=".45" strokeWidth="1.600" />
          <path d="M62 66Q84 50 114 54" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="5" strokeLinecap="round" />

          <Eyes expr={expr} round={round} />
          <Features kind={kind} />

          {/* name plate */}
          <g transform={detail ? 'translate(67 138) scale(.22)' : 'translate(86 132) scale(.22)'} aria-hidden>
            <path d="M32 33C22 31 18 28 19 22 20 12 36 11 43 17" stroke={url('so')} strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M55 18 43 8.500v19z" fill={url('so')} stroke={url('so')} strokeWidth="3" strokeLinejoin="round" />
            <path d="M32 31C42 33 46 36 45 42 44 52 28 53 21 47" stroke={url('sw')} strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M9 46 21 55.500v-19z" fill={url('sw')} stroke={url('sw')} strokeWidth="3" strokeLinejoin="round" />
          </g>
          {detail && <text x="83" y="150" fontSize="9.500" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui, sans-serif" letterSpacing="-.2">SoSwap <tspan fill={OR}>AI</tspan></text>}
          </g>

          {/* front half of the orbit rings + second ring */}
          <g transform="rotate(-16 100 100)" className="ao-ring" aria-hidden>
            <path d="M8 100A92 28 0 0 0 192 100" fill="none" stroke={OR} strokeOpacity=".25" strokeWidth="1.500" />
            <path className="ao-flow" pathLength={100} d="M8 100A92 28 0 0 0 192 100" fill="none" stroke={url('orbit')} strokeWidth="3.200" strokeLinecap="round" strokeDasharray="30 70" style={{ animationDelay: '-1.6s' }} />
          </g>
          {[[28,118,-14,-26,0],[170,70,16,-22,.7],[44,150,-18,-14,1.4],[160,150,18,-18,2.1],[100,30,4,-24,2.8],[18,92,-20,-6,3.5]].map(([x,y,dx,dy,d],i)=><circle key={i} className="ao-drift" cx={x} cy={y} r="1.700" fill={OR} style={{ ['--dx' as any]: `${dx}px`, ['--dy' as any]: `${dy}px`, animationDelay: `${d}s` }} />)}
          <circle className="ao-spark" cx="30" cy="62" r="2.200" fill="#fff" /><circle className="ao-spark ao-spark--b" cx="172" cy="128" r="2" fill={OR} /><circle className="ao-spark ao-spark--c" cx="148" cy="30" r="1.600" fill="#fff" />
        </g>
      </svg>
    </div>
  );
}
