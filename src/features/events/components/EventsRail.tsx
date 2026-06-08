'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/shared/constants';

export default function EventsRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentType = sp.get('type') ?? '';
  const isList = pathname === ROUTES.EVENTS || pathname === '/events';

  const types = [
    { value: '', label: '전체' },
    { value: 'promotion', label: '프로모션' },
    { value: 'contest', label: '공모전' },
    { value: 'webinar', label: '웨비나' },
    { value: 'news', label: '소식' },
  ];

  return (
    <>
      <aside className="rail" aria-label="이벤트 필터">
        <div>
          <p className="rail-section">유형</p>
          {types.map((t) => (
            <Link
              key={t.value || 'all'}
              href={t.value ? `${ROUTES.EVENTS}?type=${t.value}` : ROUTES.EVENTS}
              className={`rail-item ${isList && currentType === t.value ? 'rail-item-active' : ''}`}
            >
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
      </aside>

      <nav aria-label="이벤트 필터 (모바일)" className="lg:hidden -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-1 whitespace-nowrap">
          {types.map((t) => (
            <Link
              key={t.value || 'all'}
              href={t.value ? `${ROUTES.EVENTS}?type=${t.value}` : ROUTES.EVENTS}
              className={`shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[12px] font-semibold border transition-colors ${
                currentType === t.value ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
