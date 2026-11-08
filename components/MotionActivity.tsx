'use client';

import { useEffect } from 'react';

/** Pause CSS animation while the tab is hidden. Does not block interaction. */
export function MotionActivity() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.dataset.motion = document.hidden ? 'paused' : 'running';
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      delete root.dataset.motion;
    };
  }, []);
  return null;
}