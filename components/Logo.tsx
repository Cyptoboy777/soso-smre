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
      {/* Outer soft ring */}
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.18" />
      {/* Triple aperture arcs — shared centre, consistent stroke */}
      <path
        d="M32 6c14.36 0 26 11.64 26 26"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M58 32c0 14.36-11.64 26-26 26S6 46.36 6 32"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M12 18.5A22 22 0 0 1 32 10"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Inner iris */}
      <circle cx="32" cy="32" r="12" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="4.5" fill="currentColor" />
      {/* Flow tick NE — capital inflow direction */}
      <path d="M36.5 27.5 50 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="51.5" cy="12.5" r="3.25" fill="currentColor" />
    </svg>
  );
}

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <LogoMark size={30} />
      {withWordmark && (
        <span
          style={{
            fontWeight: 650,
            fontSize: 18,
            letterSpacing: '-0.04em',
            color: 'var(--text)',
            lineHeight: 1,
          }}
        >
          Flow<span style={{ color: 'var(--accent-soft)' }}>Sentinel</span>
        </span>
      )}
    </span>
  );
}
