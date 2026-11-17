'use client';
import React, { useEffect, useState } from 'react';

/* Installable-app support: registers the service worker and exposes an "Install app" action.
 * Android/desktop Chrome use the native prompt; iOS Safari has none, so we show the Share → Add to Home Screen steps. */

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

export function PwaBoot() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as BIPEvent; notify(); };
    const onInstalled = () => { deferred = null; notify(); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  return null;
}

export function useInstall() {
  const [, force] = useState(0);
  const [env, setEnv] = useState({ standalone: false, ios: false, mobile: false });
  useEffect(() => {
    const ua = navigator.userAgent;
    setEnv({
      standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
      ios: /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1),
      mobile: /android|iphone|ipad|ipod|mobile/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1),
    });
    const f = () => force((n) => n + 1);
    listeners.add(f); return () => { listeners.delete(f); };
  }, []);
  const canNative = !!deferred;
  return {
    ...env,
    canNative,
    /** Show the install affordance: not already installed, and either a native prompt exists or iOS needs manual steps. */
    available: !env.standalone && (canNative || env.ios),
    install: async () => { if (!deferred) return; const d = deferred; await d.prompt(); await d.userChoice.catch(() => undefined); deferred = null; notify(); },
  };
}

export function InstallButton({ className = '' }: { className?: string }) {
  const inst = useInstall();
  const [help, setHelp] = useState(false);
  if (!inst.available) return null;
  return (
    <>
      <button onClick={() => (inst.canNative ? inst.install() : setHelp(true))}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/20 ${className}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12m0 0-4.500-4.500M12 15l4.500-4.500M5 20h14" /></svg>
        Install app
      </button>
      {help && (
        <div role="dialog" aria-modal="true" aria-label="Install SoSwapDEX" className="fixed inset-0 z-[80] grid place-items-end bg-black/70 p-3 sm:place-items-center" onClick={() => setHelp(false)}>
          <div onClick={(e) => e.stopPropagation()} className="ss-fade w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0c] p-5">
            <div className="text-base font-bold text-zinc-50">Add SoSwapDEX to your Home Screen</div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button (square with an arrow).</li>
              <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
            </ol>
            <p className="mt-3 text-[11px] text-zinc-500">It then opens full-screen like a normal app. To trade on a phone, open SoSwapDEX inside your wallet app's browser (Connect wallet shows the shortcuts).</p>
            <button onClick={() => setHelp(false)} className="mt-4 h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-zinc-100">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
