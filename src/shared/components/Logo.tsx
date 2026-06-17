interface LogoProps {
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MARK_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

const WORD_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-[18px]',
  md: 'text-[24px]',
  lg: 'text-[30px]',
};

function LogoMark({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Marié"
      fill="none"
    >
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M8 22.4V10.2L16 18l8-7.8v12.2"
        stroke="#fff"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 18v4.4"
        stroke="#F2C879"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      <circle cx="23.2" cy="7.8" r="1.7" fill="#F2C879" />
    </svg>
  );
}

export default function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  if (variant === 'mark') {
    return <LogoMark className={`${MARK_SIZE[size]} ${className}`} />;
  }
  return (
    <span className={`inline-flex items-center gap-2 text-ink ${className}`}>
      <LogoMark className={MARK_SIZE[size]} />
      <span className={`${WORD_SIZE[size]} font-bold tracking-normal leading-none`}>
        Mari<span className="italic font-semibold">é</span>
      </span>
    </span>
  );
}
