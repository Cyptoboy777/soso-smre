"use client";

import type { ReactNode } from "react";

/** Screen change. CSS-only (transform slide/rise from phone.css plus a short fade that never starts from invisible), so the new screen is on
 * screen the moment it renders. No exit animation and no waiting: nothing here can leave a blank page. */
export default function MotionPage({ children }: { children: ReactNode }) {
  return <div className="ss-screen ss-screen-in">{children}</div>;
}
