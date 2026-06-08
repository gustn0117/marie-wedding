'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BUSINESS_TYPES, REGIONS, ROUTES } from '@/shared/constants';

interface RailItem {
  href: string;
  label: string;
  matchKey?: string;
  matchValue?: string;
}

interface RailSection {
  title: string;
  items: RailItem[];
}

export default function JobsRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentBiz = sp.get('businessType') ?? '';
  const currentRegion = sp.get('region') ?? '';
  const currentType = sp.get('type') ?? '';

  const isActive = (item: RailItem): boolean => {
    if (pathname !== ROUTES.JOBS && pathname !== '/jobs') return false;
    if (item.matchKey === undefined) {
      // 전체 — 모든 필터 없을 때
      return !currentBiz && !currentRegion && !currentType;
    }
    const current = sp.get(item.matchKey) ?? '';
    return current === item.matchValue;
  };

  const sections: RailSection[] = [
    {
      title: '빠른 보기',
      items: [
        { href: ROUTES.JOBS, label: '전체 공고' },
        { href: `${ROUTES.JOBS}?type=matching`, label: '파트너 섭외', matchKey: 'type', matchValue: 'matching' },
        { href: `${ROUTES.JOBS}?urgent=1`, label: '마감 임박', matchKey: 'urgent', matchValue: '1' },
      ],
    },
    {
      title: '직군',
      items: BUSINESS_TYPES.map((b) => ({
        href: `${ROUTES.JOBS}?businessType=${b.value}`,
        label: b.label,
        matchKey: 'businessType',
        matchValue: b.value,
      })),
    },
    {
      title: '지역',
      items: REGIONS.slice(0, 8).map((r) => ({
        href: `${ROUTES.JOBS}?region=${r.value}`,
        label: r.label,
        matchKey: 'region',
        matchValue: r.value,
      })),
    },
  ];

  return (
    <>
      {/* 데스크탑 sticky rail */}
      <aside className="rail" aria-label="채용 정보 필터">
        {sections.map((sec) => (
          <div key={sec.title}>
            <p className="rail-section">{sec.title}</p>
            {sec.items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rail-item ${isActive(item) ? 'rail-item-active' : ''}`}
                aria-current={isActive(item) ? 'page' : undefined}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
        <div>
          <p className="rail-section">관련</p>
          <Link href={ROUTES.JOBS_NEW} className="rail-item">
            <span>+ 공고 등록</span>
          </Link>
          <Link href={ROUTES.MYPAGE_BOOKMARKS} className="rail-item">
            <span>저장한 공고</span>
          </Link>
          <Link href={ROUTES.MYPAGE_SAVED_SEARCHES} className="rail-item">
            <span>저장한 검색</span>
          </Link>
        </div>
      </aside>

      {/* 모바일 가로 스크롤 칩 */}
      <nav aria-label="채용 정보 필터 (모바일)" className="lg:hidden -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-1 whitespace-nowrap">
          {[
            { href: ROUTES.JOBS, label: '전체', match: !currentBiz && !currentType },
            ...BUSINESS_TYPES.map((b) => ({
              href: `${ROUTES.JOBS}?businessType=${b.value}`,
              label: b.label,
              match: currentBiz === b.value,
            })),
            { href: `${ROUTES.JOBS}?type=matching`, label: '파트너 섭외', match: currentType === 'matching' },
          ].map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className={`shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[12px] font-semibold border transition-colors ${
                c.match ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
