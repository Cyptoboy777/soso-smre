export function LogoMark({
  size = 28,
  className = '',
  animated = false,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={`logo-mark ${animated ? 'logo-mark-animated' : ''} ${className}`.trim()}
      style={{ color: 'var(--accent)' }}
    >
      <path
        className="logo-lid"
        d="M8 32c9-14 20-21 24-21s15 7 24 21c-9 14-20 21-24 21S17 46 8 32Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <circle className="logo-iris" cx="32" cy="32" r="9" stroke="currentColor" strokeWidth="3" opacity="0.95" />
      <circle className="logo-pupil" cx="32" cy="32" r="3.5" fill="currentColor" />
      <path
        className="logo-flow"
        d="M15 26c5-3 11-5 17-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <LogoMark size={30} animated />
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
