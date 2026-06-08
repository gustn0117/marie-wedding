import Link from 'next/link';
import type { ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * 플랫폼 표준 breadcrumb — Linear/Notion 스타일.
 * 마지막 아이템은 자동으로 current (text-ink font-semibold).
 */
export default function Breadcrumb({ items, separator }: { items: BreadcrumbItem[]; separator?: ReactNode }) {
  const sep = separator ?? <span className="crumb-sep">/</span>;
  return (
    <nav aria-label="페이지 위치" className="crumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-ink transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'crumb-current' : ''}>{item.label}</span>
            )}
            {!isLast && sep}
          </span>
        );
      })}
    </nav>
  );
}
