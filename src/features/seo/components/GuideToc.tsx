'use client';

import { useEffect, useState } from 'react';

export interface GuideTocItem {
  id: string;
  label: string;
}

/**
 * 가이드 목차(lg 이상, 왼쪽에 따라다님) — 지금 읽고 있는 섹션을 표시한다.
 * 화면 위쪽 20%~30% 띠에 걸린 섹션을 '지금 읽는 곳'으로 본다.
 */
export default function GuideToc({ items }: { items: GuideTocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-labelledby="guide-toc-title" className="sticky top-[calc(var(--header-h)+32px)]">
      <p id="guide-toc-title" className="text-[13px] font-semibold text-gray-500">목차</p>
      <ol className="mt-3 border-l border-gray-200">
        {items.map((item) => {
          const on = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={on ? 'location' : undefined}
                className={`-ml-px block border-l-2 py-2 pl-4 text-[14px] leading-snug transition-colors ${
                  on ? 'border-primary font-semibold text-ink' : 'border-transparent text-gray-500 hover:text-ink'
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
