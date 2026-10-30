export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
      style={{ color: 'var(--accent)' }}
    >
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M32 8a24 24 0 0 1 20.78 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M52.78 44A24 24 0 0 1 32 56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M11.22 44A24 24 0 0 1 32 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="5" fill="currentColor" />
      <path d="M32 32l14-14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="18" r="3" fill="currentColor" />
    </svg>
  );
}

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <LogoMark size={28} />
      {withWordmark && (
        <span
          style={{
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
          }}
        >
          FlowSentinel
        </span>
      )}
    </span>
  );
}
