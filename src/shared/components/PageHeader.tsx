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
 * 플랫폼 페이지 헤더 — Toss 친화 큰 타이포.
 * 슬롯: eyebrow / title / description / breadcrumb (위) + actions (우측)
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
  const titleClass = size === 'lg'
    ? 'text-[32px] sm:text-[44px] font-extrabold text-ink leading-[1.05] tracking-tighter'
    : size === 'sm'
    ? 'text-[20px] sm:text-[24px] font-bold text-ink leading-tight tracking-tight'
    : 'page-title';

  return (
    <header className={`mb-8 ${className}`}>
      {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="page-eyebrow mb-2">{eyebrow}</p>}
          <h1 className={titleClass}>{title}</h1>
          {description && <p className="page-subtitle max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
