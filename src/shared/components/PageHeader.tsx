import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 공용 페이지 헤더 — ink 색 + 무채색 톤.
 * 옛 platform-hero/platform-eyebrow 대체.
 */
export default function PageHeader({ title, description, actions, size = 'md' }: PageHeaderProps) {
  const titleSize = size === 'lg' ? 'text-[28px] sm:text-[32px]' : size === 'sm' ? 'text-[20px] sm:text-[22px]' : 'text-[24px] sm:text-[28px]';
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 pb-4">
      <div>
        <h1 className={`${titleSize} font-extrabold tracking-tight text-ink leading-tight`}>{title}</h1>
        {description && <p className="mt-1.5 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
