'use client';

import { useEffect } from 'react';

/**
 * WalletErrorSuppressor
 *
 * The error "Cannot redefine property: ethereum" is caused by two browser
 * wallet extensions (e.g. MetaMask + OKX Wallet) both trying to inject
 * window.ethereum via Object.defineProperty. The second one fails because
 * the first already marked it non-configurable.
 *
 * This is 100% an extension-vs-extension conflict — NOT our code.
 * We suppress this specific error so it doesn't pollute the console or
 * trigger React's error overlay during development.
 */
export default function WalletErrorSuppressor() {
  useEffect(() => {
    const originalOnError = window.onerror;

    window.onerror = (message, source, lineno, colno, error) => {
      // Suppress the extension-vs-extension ethereum redefinition error
      const msg = String(message ?? '');
      if (
        msg.includes('Cannot redefine property: ethereum') ||
        msg.includes('Cannot redefine property: solana') ||
        (typeof source === 'string' && source.includes('chrome-extension://'))
      ) {
        return true; // true = suppress (don't bubble to React overlay)
      }
      // Pass all other errors through normally
      return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
    };

    // Also handle unhandled promise rejections from extensions
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const msg = String(e.reason?.message ?? e.reason ?? '');
      if (
        msg.includes('Cannot redefine property: ethereum') ||
        msg.includes('Cannot redefine property: solana')
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.onerror = originalOnError;
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null; // renders nothing
}
