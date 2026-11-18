"use client";

import type { NewsHeadline } from "@/lib/trade-guard";
import { safeHttpUrl } from "@/lib/safe-url";

function ago(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
}

export default function MoveNewsLine({ item, compact }: { item: NewsHeadline; compact?: boolean }) {
  const meta = [item.source, item.time ? ago(item.time) : ""].filter(Boolean).join(" · ");
  const href = safeHttpUrl(item.url);
  const title = (
    href
      ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>{item.title}</a>
      : <span className="font-semibold text-zinc-300">{item.title}</span>
  );
  return (
    <div className="ss-moved" data-testid="move-news" title={item.title}>
      <span className="ss-moved__label">{compact ? "Why:" : "Why did it move?"}</span>
      <span className="min-w-0 truncate">{title}{meta ? <span className="ss-moved__meta"> · {meta}</span> : null}</span>
    </div>
  );
}
