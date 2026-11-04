'use client';

import { useMemo, useState } from 'react';
import { buildShareUrl, readStoredRef } from '@/lib/referral';
import { useLocale } from './LocaleProvider';

function directionLabel(side?: string): string {
  if (side === 'LONG') return 'Bullish';
  if (side === 'SHORT') return 'Bearish';
  if (side === 'FLAT') return 'Neutral';
  return side ?? 'Idea';
}

type Props = {
  ideaId?: string;
  headline: string;
  side?: string;
  symbol?: string;
  confidence?: number | string;
  body?: string;
};

export function ShareIdeaCard({
  ideaId,
  headline,
  side,
  symbol,
  confidence,
  body,
}: Props) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return buildShareUrl({
      origin: window.location.origin,
      path: '/',
      ideaId: ideaId ?? `${side ?? 'idea'}-${symbol ?? 'flow'}`,
      ref: readStoredRef() ?? 'flowsentinel',
    });
  }, [ideaId, side, symbol]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${headline}\n${shareUrl}\nFlowSentinel (not financial advice)`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <aside
      className="panel"
      style={{ padding: 18, display: 'grid', gap: 10 }}
      aria-label={t.shareTitle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ letterSpacing: '-0.02em' }}>{t.shareTitle}</strong>
        <span className="badge" style={{ color: 'var(--accent-soft)', borderColor: 'rgba(255,79,32,0.35)' }}>
          {directionLabel(side)}{symbol ? ` · ${symbol.replace(/v/g, '').replace('_', '/')}` : ''}
        </span>
      </div>
      <p style={{ margin: 0, color: 'var(--text)', fontSize: 15 }}>{headline}</p>
      {body ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.45 }}>{body}</p>
      ) : null}
      {confidence != null ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
          Confidence {String(confidence)}
        </p>
      ) : null}
      <button className="btn btn-ghost" type="button" onClick={() => void copy()} style={{ justifySelf: 'start' }}>
        {copied ? t.shareCopied : t.shareCopy}
      </button>
    </aside>
  );
}
