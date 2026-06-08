'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BUSINESS_TYPES, REGIONS, ROUTES } from '@/shared/constants';

export default function DirectoryRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentBiz = sp.get('businessType') ?? '';
  const currentRegion = sp.get('region') ?? '';
  const isList = pathname === ROUTES.DIRECTORY || pathname === '/directory';

  return (
    <>
      <aside className="rail" aria-label="업체 디렉토리 필터">
        <div>
          <p className="rail-section">업종</p>
          <Link
            href={ROUTES.DIRECTORY}
            className={`rail-item ${isList && !currentBiz ? 'rail-item-active' : ''}`}
          >
            <span>전체</span>
          </Link>
          {BUSINESS_TYPES.map((b) => (
            <Link
              key={b.value}
              href={`${ROUTES.DIRECTORY}?businessType=${b.value}`}
              className={`rail-item ${isList && currentBiz === b.value ? 'rail-item-active' : ''}`}
            >
              <span>{b.label}</span>
            </Link>
          ))}
        </div>
        <div>
          <p className="rail-section">지역</p>
          {REGIONS.slice(0, 9).map((r) => (
            <Link
              key={r.value}
              href={`${ROUTES.DIRECTORY}?region=${r.value}`}
              className={`rail-item ${isList && currentRegion === r.value ? 'rail-item-active' : ''}`}
            >
              <span>{r.label}</span>
            </Link>
          ))}
        </div>
        <div>
          <p className="rail-section">관련</p>
          <Link href={ROUTES.DIRECTORY_REGISTER} className="rail-item">
            <span>+ 업체 등록</span>
          </Link>
        </div>
      </aside>

      <nav aria-label="업체 디렉토리 필터 (모바일)" className="lg:hidden -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-1 whitespace-nowrap">
          <Link
            href={ROUTES.DIRECTORY}
            className={`shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[12px] font-semibold border transition-colors ${
              isList && !currentBiz ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            전체
          </Link>
          {BUSINESS_TYPES.map((b) => (
            <Link
              key={b.value}
              href={`${ROUTES.DIRECTORY}?businessType=${b.value}`}
              className={`shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[12px] font-semibold border transition-colors ${
                currentBiz === b.value ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {b.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
