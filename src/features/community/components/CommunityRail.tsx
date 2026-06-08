'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { POST_CATEGORIES, ROUTES } from '@/shared/constants';

export default function CommunityRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentCategory = sp.get('category') ?? '';
  const isList = pathname === ROUTES.COMMUNITY || pathname === '/community';

  return (
    <>
      <aside className="rail" aria-label="커뮤니티 카테고리">
        <div>
          <p className="rail-section">카테고리</p>
          <Link
            href={ROUTES.COMMUNITY}
            className={`rail-item ${isList && !currentCategory ? 'rail-item-active' : ''}`}
            aria-current={isList && !currentCategory ? 'page' : undefined}
          >
            <span>전체</span>
          </Link>
          {POST_CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              href={`${ROUTES.COMMUNITY}?category=${cat.value}`}
              className={`rail-item ${isList && currentCategory === cat.value ? 'rail-item-active' : ''}`}
              aria-current={isList && currentCategory === cat.value ? 'page' : undefined}
            >
              <span>{cat.label}</span>
            </Link>
          ))}
        </div>
        <div>
          <p className="rail-section">정렬</p>
          <Link
            href={`${ROUTES.COMMUNITY}?sort=new`}
            className={`rail-item ${sp.get('sort') === 'new' ? 'rail-item-active' : ''}`}
          >
            <span>최신순</span>
          </Link>
          <Link
            href={`${ROUTES.COMMUNITY}?sort=hot`}
            className={`rail-item ${sp.get('sort') === 'hot' ? 'rail-item-active' : ''}`}
          >
            <span>인기순</span>
          </Link>
        </div>
        <div>
          <p className="rail-section">관련</p>
          <Link href={ROUTES.COMMUNITY_NEW} className="rail-item">
            <span>+ 글 작성</span>
          </Link>
          <Link href={ROUTES.MYPAGE_BOOKMARKS} className="rail-item">
            <span>저장한 글</span>
          </Link>
        </div>
      </aside>

      <nav aria-label="커뮤니티 카테고리 (모바일)" className="lg:hidden -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-1 whitespace-nowrap">
          <Link
            href={ROUTES.COMMUNITY}
            className={`shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[12px] font-semibold border transition-colors ${
              isList && !currentCategory ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            전체
          </Link>
          {POST_CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              href={`${ROUTES.COMMUNITY}?category=${cat.value}`}
              className={`shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[12px] font-semibold border transition-colors ${
                currentCategory === cat.value ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
