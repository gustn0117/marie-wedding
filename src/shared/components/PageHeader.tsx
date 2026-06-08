import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  breadcrumb?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * 플랫폼 표준 페이지 헤더 — Linear/Stripe 스타일.
 * 슬롯: eyebrow / title / description / breadcrumb (위) + actions (우측)
 * .page-title / .page-subtitle / .page-eyebrow 토큰 사용 (globals.css).
 */
export default function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  breadcrumb,
  size = 'md',
  className = '',
}: PageHeaderProps) {
  const titleSize = size === 'lg'
    ? 'text-[26px] sm:text-[32px]'
    : size === 'sm'
    ? 'text-[18px] sm:text-[20px]'
    : 'page-title';
  return (
    <header className={`mb-6 ${className}`}>
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="min-w-0">
          {eyebrow && <p className="page-eyebrow mb-1">{eyebrow}</p>}
          <h1 className={size === 'md' ? titleSize : `${titleSize} font-bold text-ink leading-tight tracking-tight`}>
            {title}
          </h1>
          {description && <p className="page-subtitle">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
