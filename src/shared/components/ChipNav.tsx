'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export interface ChipItem {
  href: string;
  label: string;
  active?: boolean;
}

/**
 * 가로 스크롤 칩 nav — Linear/Stripe 스타일 1줄.
 * jobs/community/directory/events 페이지 본문 상단에 사용.
 */
export default function ChipNav({ items, trailing }: { items: ChipItem[]; trailing?: ReactNode }) {
  return (
    <nav aria-label="카테고리" className="mb-4 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 pb-1 whitespace-nowrap">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`shrink-0 px-3.5 h-9 inline-flex items-center rounded-full text-[13px] font-bold border transition-colors ${
              item.active
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        ))}
        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </div>
    </nav>
  );
}
