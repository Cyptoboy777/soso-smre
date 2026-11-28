"use client";

import type { ReactNode } from "react";

/** Tab change inside a page. Keyed so the panel remounts with a short CSS animation; no exit phase, so the old tab never leaves a gap. */
export default function AnimatedTabs({ activeKey, children }: { activeKey: string; children: ReactNode }) {
  return <div key={activeKey} className="ss-screen ss-screen--tab ss-screen-in">{children}</div>;
}
