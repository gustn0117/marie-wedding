'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export interface ChipItem {
  href: string;
  label: string;
  active?: boolean;
}

/**
 * 가로 nav — Linear/Stripe 스타일 underline 탭.
 * 둥근 칩 대신 텍스트 + 활성 시 하단 굵은 underline.
 */
export default function ChipNav({ items, trailing }: { items: ChipItem[]; trailing?: ReactNode }) {
  return (
    <nav
      aria-label="카테고리"
      className="mb-5 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 overflow-x-auto border-b border-gray-200"
    >
      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`shrink-0 px-3 sm:px-4 h-11 inline-flex items-center text-[14px] font-bold border-b-2 -mb-px transition-colors ${
              item.active
                ? 'text-ink border-ink'
                : 'text-gray-500 border-transparent hover:text-ink hover:border-gray-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
        {trailing && <span className="ml-auto shrink-0 pl-3">{trailing}</span>}
      </div>
    </nav>
  );
}
