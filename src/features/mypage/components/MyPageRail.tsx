'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/shared/hooks/useAuth';

interface RailItem {
  href: string;
  label: string;
  icon: string; // SVG path d
  businessOnly?: boolean; // true면 업체 회원에게만 노출
}

interface RailSection {
  title: string;
  items: RailItem[];
  businessOnly?: boolean;
}

const SECTIONS: RailSection[] = [
  {
    title: '개요',
    items: [
      { href: ROUTES.MYPAGE, label: '마이페이지', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { href: ROUTES.MYPAGE_DASHBOARD, label: '공고 성과', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605', businessOnly: true },
    ],
  },
  {
    title: '구인구직',
    items: [
      { href: ROUTES.JOBS_NEW, label: '공고 등록', icon: 'M12 4.5v15m7.5-7.5h-15', businessOnly: true },
      { href: ROUTES.MYPAGE, label: '내 공고·지원', icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0' },
      { href: ROUTES.MYPAGE_BOOKMARKS, label: '스크랩 공고', icon: 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z' },
      { href: ROUTES.MYPAGE_SAVED_SEARCHES, label: '저장한 검색', icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
    ],
  },
  {
    title: '프로필',
    items: [
      { href: ROUTES.MYPAGE_PORTFOLIOS, label: '포트폴리오', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
      { href: ROUTES.MYPAGE_MESSAGES, label: '쪽지', icon: 'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
      { href: ROUTES.DIRECTORY_REGISTER, label: '공개 프로필', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z', businessOnly: true },
    ],
  },
  {
    title: '설정',
    items: [
      { href: ROUTES.MYPAGE_EDIT, label: '프로필 수정', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125' },
      { href: ROUTES.MYPAGE_VERIFICATION, label: '사업자 인증', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', businessOnly: true },
      { href: ROUTES.MYPAGE_NOTIFICATIONS, label: '알림', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
      { href: ROUTES.MYPAGE_PASSWORD, label: '비밀번호', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' },
    ],
  },
];

interface MyPageRailProps {
  /** SSR 에서 marie_profile 쿠키로 미리 결정된 account_type — hydration flash 방지 */
  initialAccountType?: 'business' | 'individual' | null;
}

export default function MyPageRail({ initialAccountType = null }: MyPageRailProps = {}) {
  const pathname = usePathname();
  const { profile } = useAuth();
  // useAuth 가 hydration 후 확정한 값이 있으면 그걸 우선, 아니면 SSR prop.
  const accountType = profile?.account_type ?? initialAccountType;
  const isBusiness = accountType === 'business';

  // 개인 회원에겐 공고 운영 관련 메뉴를 숨긴다 — 구인구직 섹션에서 '공고 등록' 빠지고,
  // 개요의 '공고 성과', 프로필의 '공개 프로필', 설정의 '사업자 인증'도 제외.
  const visibleSections = SECTIONS
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => isBusiness || !it.businessOnly) }))
    .filter((sec) => sec.items.length > 0);

  // 모바일 칩도 동일한 룰
  const mobileChips = [
    isBusiness && { href: ROUTES.MYPAGE_DASHBOARD, label: '공고 성과' },
    isBusiness && { href: ROUTES.JOBS_NEW, label: '공고 등록' },
    { href: ROUTES.MYPAGE, label: isBusiness ? '내 공고·지원' : '내 지원·스크랩' },
    { href: ROUTES.MYPAGE_BOOKMARKS, label: '스크랩' },
    { href: ROUTES.MYPAGE_SAVED_SEARCHES, label: '저장 검색' },
    { href: ROUTES.MYPAGE_MESSAGES, label: '쪽지' },
    { href: ROUTES.MYPAGE_PORTFOLIOS, label: '포트폴리오' },
    { href: ROUTES.MYPAGE_EDIT, label: '프로필' },
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  return (
    <>
      {/* 데스크탑 sticky rail */}
      <aside className="rail" aria-label="마이페이지 메뉴">
        {visibleSections.map((sec) => (
          <div key={sec.title}>
            <p className="rail-section">{sec.title}</p>
            {sec.items.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== ROUTES.MYPAGE && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rail-item ${isActive ? 'rail-item-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <svg className="rail-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      {/* 모바일 가로 스크롤 칩 — 회원 유형별로 적합한 항목만 */}
      <nav aria-label="마이페이지 메뉴 (모바일)" className="lg:hidden -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-1 whitespace-nowrap">
          {mobileChips.map((c) => {
            const isActive = pathname === c.href || pathname.startsWith(c.href);
            return (
              <Link
                key={c.href}
                href={c.href}
                className={`shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[12px] font-semibold border transition-colors ${
                  isActive ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
