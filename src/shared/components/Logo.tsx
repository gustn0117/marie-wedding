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
      <rect width="32" height="32" rx="4" fill="currentColor" />
      <path
        d="M8.4 22.5V9.5h2.6l3 8.5 3-8.5h2.6v13h-1.9v-9.6l-2.7 9.6h-1.4l-2.7-9.6v9.6H8.4z"
        fill="#fff"
      />
      <circle cx="23.6" cy="11.6" r="1.3" fill="#fff" />
    </svg>
  );
}

export default function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  if (variant === 'mark') {
    return <LogoMark className={`${MARK_SIZE[size]} ${className}`} />;
  }
  return (
    <span className={`inline-flex items-center gap-2 text-primary ${className}`}>
      <LogoMark className={MARK_SIZE[size]} />
      <span className={`${WORD_SIZE[size]} font-bold tracking-tight leading-none`}>
        Mari<span className="italic font-semibold">é</span>
      </span>
    </span>
  );
}
