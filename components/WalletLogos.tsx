import React, { useState } from 'react';

/** Official-style marks for the connect modal. Used when a wallet has no EIP-6963 icon (or it failed to load). */
export type WalletKind = 'metamask' | 'rabby' | 'coinbase' | 'okx' | 'trust' | 'rainbow' | 'walletconnect' | 'brave' | 'bitget' | 'phantom';

const KINDS: { kind: WalletKind; match: string[] }[] = [
  { kind: 'metamask', match: ['metamask', 'io.metamask'] },
  { kind: 'rabby', match: ['rabby', 'io.rabby'] },
  { kind: 'coinbase', match: ['coinbase', 'com.coinbase'] },
  { kind: 'okx', match: ['okx', 'okex', 'com.okex'] },
  { kind: 'trust', match: ['trust', 'com.trustwallet'] },
  { kind: 'rainbow', match: ['rainbow', 'me.rainbow'] },
  { kind: 'walletconnect', match: ['walletconnect'] },
  { kind: 'brave', match: ['brave', 'com.brave'] },
  { kind: 'bitget', match: ['bitget', 'bitkeep'] },
  { kind: 'phantom', match: ['phantom', 'app.phantom'] },
];

export function resolveWalletKind(id?: string, name?: string): WalletKind | null {
  const s = `${id ?? ''} ${name ?? ''}`.toLowerCase();
  for (const k of KINDS) if (k.match.some((m) => s.includes(m))) return k.kind;
  return null;
}

export function OfficialMark({ kind, size = 40 }: { kind: WalletKind; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 40 40', 'aria-hidden': true as const };
  switch (kind) {
    case 'metamask':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#fff" />
          <g transform="translate(3 3) scale(0.10672)">
            <path fill="#e2761b" stroke="#e2761b" strokeLinecap="round" strokeLinejoin="round" d="m274.1 35.5-99.5 73.9L193 65.8z" />
            <path fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round" d="m44.4 35.5 98.7 74.6-17.5-44.3zm193.9 171.3-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" />
            <path fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round" d="m103.6 138.2-15.8 23.9 56.3 2.5-2-60.5zm111.3 0-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5 33.9 16.5-4.7-39.3z" />
            <path fill="#d7c1b3" stroke="#d7c1b3" strokeLinecap="round" strokeLinejoin="round" d="m211.8 247.4-33.9-16.5 2.7 22.1-.3 9.3zm-105 0 31.5 14.9-.2-9.3 2.5-22.1z" />
            <path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="m138.8 193.5-28.2-8.3 19.9-9.1zm40.9 0 8.3-17.4 20 9.1z" />
            <path fill="#cd6116" stroke="#cd6116" strokeLinecap="round" strokeLinejoin="round" d="m106.8 247.4 4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7zm23.8-44.7-56.2 2.5 5.2 28.9 8.3-17.4 20 9.1zm-120.2 23.1 20-9.1 8.2 17.4 5.3-28.9-56.3-2.5z" />
            <path fill="#e4751f" stroke="#e4751f" strokeLinecap="round" strokeLinejoin="round" d="m87.8 162.1 23.6 46-.8-22.9zm120.3 23.1-1 22.9 23.7-46zm-64-20.6-5.3 28.9 6.6 34.1 1.5-44.9zm30.5 0-2.7 18 1.2 45 6.7-34.1z" />
            <path fill="#f6851b" stroke="#f6851b" strokeLinecap="round" strokeLinejoin="round" d="m179.8 193.5-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zm-69.2-8.3.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z" />
            <path fill="#c0ad9e" stroke="#c0ad9e" strokeLinecap="round" strokeLinejoin="round" d="m180.3 262.3.3-9.3-2.5-2.2h-37.7l-2.3 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z" />
            <path fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" d="m177.9 230.9-4.8-3.3h-27.7l-4.8 3.3-2.5 22.1 2.3-2.2h37.7l2.5 2.2z" />
            <path fill="#763d16" stroke="#763d16" strokeLinecap="round" strokeLinejoin="round" d="m278.3 114.2 8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z" />
            <path fill="#f6851b" stroke="#f6851b" strokeLinecap="round" strokeLinejoin="round" d="m267.2 153.5-52.3-15.3 15.9 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4 3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z" />
          </g>
        </svg>
      );
    case 'rabby':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#8697FF" />
          <path fill="#fff" d="M14.5 8.5c1.2 0 2.6 1.6 3.4 3.7.3-.3.7-.5 1.1-.6.5-.2 1-.2 1.5 0 .4.1.8.3 1.1.6.8-2.1 2.2-3.7 3.4-3.7 1.6 0 3 2.6 3 6.2 0 2.3-.6 4.2-1.6 5.2 1.5 1.3 2.4 3.2 2.4 5.3 0 4.2-3.8 7.3-9.8 7.3s-9.8-3.1-9.8-7.3c0-2.1.9-4 2.4-5.3-1-1-1.6-2.9-1.6-5.2 0-3.6 1.4-6.2 3-6.2z" />
          <circle cx="16.4" cy="22.2" r="1.5" fill="#1a1a2e" />
          <circle cx="23.6" cy="22.2" r="1.5" fill="#1a1a2e" />
          <path fill="#FF7A59" d="M20 25.6c1.3 0 2.3.7 2.3 1.2 0 .2-.4.3-2.3.3s-2.3-.1-2.3-.3c0-.5 1-1.2 2.3-1.2z" />
        </svg>
      );
    case 'coinbase':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#0052FF" />
          <circle cx="20" cy="20" r="10" fill="#fff" />
          <circle cx="20" cy="20" r="5.2" fill="#0052FF" />
          <rect x="20" y="14.8" width="12" height="10.4" fill="#0052FF" />
        </svg>
      );
    case 'okx':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#000" />
          <g fill="#fff">
            <rect x="8" y="8" width="8.4" height="8.4" rx="1.2" />
            <rect x="23.6" y="8" width="8.4" height="8.4" rx="1.2" />
            <rect x="15.8" y="15.8" width="8.4" height="8.4" rx="1.2" />
            <rect x="8" y="23.6" width="8.4" height="8.4" rx="1.2" />
            <rect x="23.6" y="23.6" width="8.4" height="8.4" rx="1.2" />
          </g>
        </svg>
      );
    case 'trust':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#3375BB" />
          <path fill="#fff" d="M20 8.4c3.6 2 7.2 2.6 10.4 2.6v8.3c0 6.2-4 10.6-10.4 12.3C13.6 29.9 9.6 25.5 9.6 19.3V11c3.2 0 6.8-.6 10.4-2.6z" />
          <path fill="#3375BB" d="M20 13.2v14.2c4.4-1.2 7.2-4.2 7.2-8.4v-5.6c-2.3 0-4.8.3-7.2 1.8z" />
        </svg>
      );
    case 'rainbow':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="ss-rb" x1="8" y1="32" x2="32" y2="8" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF3B30" /><stop offset=".25" stopColor="#FF9500" /><stop offset=".5" stopColor="#FFCC00" /><stop offset=".75" stopColor="#34C759" /><stop offset="1" stopColor="#007AFF" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="10" fill="url(#ss-rb)" />
          <path fill="#fff" fillOpacity=".9" d="M10 24.5a10 10 0 0 1 20 0h-3.2a6.8 6.8 0 0 0-13.6 0H10z" />
        </svg>
      );
    case 'walletconnect':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#3B99FC" />
          <path fill="#fff" d="M12.2 16.2c4.3-4.2 11.3-4.2 15.6 0l.5.5c.15.15.15.4 0 .54l-1.78 1.74a.38.38 0 0 1-.53 0l-.72-.7c-3-2.94-7.86-2.94-10.86 0l-.77.7a.38.38 0 0 1-.53 0L11.63 17.24a.39.39 0 0 1 0-.54l.57-.5zm18.65 3.48 1.58 1.54c.15.15.15.4 0 .55l-7.14 7a1.14 1.14 0 0 1-1.6 0l-5.06-4.95a.19.19 0 0 0-.27 0l-5.06 4.95a1.14 1.14 0 0 1-1.6 0l-7.14-7a.39.39 0 0 1 0-.55l1.58-1.54a.38.38 0 0 1 .53 0l5.07 4.96c.07.07.2.07.27 0l5.06-4.96a1.14 1.14 0 0 1 1.6 0l5.06 4.96c.08.07.2.07.27 0l5.07-4.96a.38.38 0 0 1 .53 0z" />
        </svg>
      );
    case 'brave':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#FB542B" />
          <path fill="#fff" d="M20 8.5 28.5 12l1 6.2-3.2 11.3L20 31.5l-6.3-2-3.2-11.3 1-6.2L20 8.5zm0 3.2-5.2 2.1-.6 3.8 2.1 1.3L20 16l3.7 2.6 2.1-1.3-.6-3.8L20 11.7zm-4.2 9.2 4.2 8.4 4.2-8.4L20 18.6l-4.2 2.3z" />
        </svg>
      );
    case 'bitget':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#00F0FF" />
          <path fill="#0a0a0c" d="M12 12h7.4v7.4H12V12zm8.6 0H28v7.4h-7.4V12zM12 20.6h7.4V28H12v-7.4zm8.6 3.7H28V28h-7.4v-3.7z" />
        </svg>
      );
    case 'phantom':
      return (
        <svg {...common}>
          <rect width="40" height="40" rx="10" fill="#AB9FF2" />
          <path fill="#fff" d="M9 21.5c0-6 4.8-10.5 11-10.5 6.8 0 11 4.2 11 10.2 0 2.3-.7 4.3-2.1 5.8-.4-2.3-1.8-3.5-3.5-3.5-2.6 0-3.7 2.2-6.2 2.2-2 0-3.4-1.2-3.4-3 0-3.3 3.3-5.2 7.2-5.2 1.3 0 2.5.2 3.5.5-.4-1.7-1.9-2.8-4.2-2.8-4.6 0-8.3 3-8.3 7.3 0 .7.1 1.3.3 1.9C11 23.6 9 23 9 21.5z" />
          <circle cx="24.2" cy="19.2" r="1.2" fill="#534C86" />
        </svg>
      );
  }
}

export function WalletGlyph({ id, name, src, size = 40 }: { id?: string; name: string; src?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const kind = resolveWalletKind(id, name);
  const box: React.CSSProperties = { width: size, height: size };
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={box}
        className="shrink-0 rounded-[12px] border border-white/10 bg-white object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  if (kind) return <span className="inline-flex shrink-0 overflow-hidden rounded-[12px] border border-white/10" style={box}><OfficialMark kind={kind} size={size} /></span>;
  return (
    <span className="grid shrink-0 place-items-center rounded-[12px] border border-white/10 bg-white/[0.08] text-sm font-bold text-zinc-200" style={box}>
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}
