'use client';
import React, { useEffect, useState } from 'react';

/* Phones have no browser-extension wallets. These links reopen this exact page inside a wallet app's built-in browser,
 * where the wallet is injected and "Connect" works. No keys or data are involved: only this page's URL is passed along. */

const targets = (url: string) => {
  const enc = encodeURIComponent(url);
  const bare = url.replace(/^https?:\/\//, '');
  return [
    { name: 'MetaMask', href: `https://metamask.app.link/dapp/${bare}`, hue: '#f6851b' },
    { name: 'Trust Wallet', href: `https://link.trustwallet.com/open_url?coin_id=60&url=${enc}`, hue: '#3375bb' },
    { name: 'Coinbase Wallet', href: `https://go.cb-w.com/dapp?cb_url=${enc}`, hue: '#1652f0' },
    { name: 'OKX Wallet', href: `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${enc}`)}`, hue: '#ffffff' },
  ];
};

export default function MobileWallets({ detected }: { detected: boolean }) {
  const [url, setUrl] = useState('');
  const [mobile, setMobile] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setUrl(window.location.origin + '/');
    const ua = navigator.userAgent;
    setMobile(/android|iphone|ipad|ipod|mobile/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1));
  }, []);
  if (!url || detected || !mobile) return null;
  return (
    <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.05] p-3.5">
      <div className="text-sm font-semibold text-zinc-50">On a phone? Open SoSwap in your wallet app</div>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">Mobile browsers can't talk to wallets directly. Tap your wallet below: it opens SoSwap inside the wallet's own browser, then press <b className="text-zinc-200">Connect Wallet</b> there.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {targets(url).map((t) => (
          <a key={t.name} href={t.href} target="_blank" rel="noreferrer noopener" className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 text-[13px] font-semibold text-zinc-100 transition hover:border-orange-500/50">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.hue }} />{t.name}
          </a>
        ))}
      </div>
      <button onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => undefined); }}
        className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] text-[12px] font-semibold text-zinc-300">{copied ? 'Link copied' : 'Copy link to paste in any wallet browser'}</button>
    </div>
  );
}
