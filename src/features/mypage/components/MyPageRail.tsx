'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/shared/constants';

interface RailItem {
  href: string;
  label: string;
  icon: string; // SVG path d
}

interface RailSection {
  title: string;
  items: RailItem[];
}

const SECTIONS: RailSection[] = [
  {
    title: '개요',
    items: [
      { href: ROUTES.MYPAGE, label: '마이페이지', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { href: ROUTES.MYPAGE_DASHBOARD, label: '대시보드', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605' },
    ],
  },
  {
    title: 'B2B 거래',
    items: [
      { href: ROUTES.QUOTATIONS, label: '견적', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
      { href: ROUTES.CONTRACTS, label: '계약', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' },
      { href: ROUTES.BOOKINGS, label: '예약·일정', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
      { href: ROUTES.SETTLEMENTS, label: '정산', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
  {
    title: '활동',
    items: [
      { href: ROUTES.MYPAGE_PORTFOLIOS, label: '포트폴리오', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
      { href: ROUTES.MYPAGE_AVAILABILITY, label: '가용 일정', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
      { href: ROUTES.MYPAGE_MESSAGES, label: '메시지', icon: 'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
      { href: ROUTES.MYPAGE_BOOKMARKS, label: '저장한 항목', icon: 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z' },
      { href: ROUTES.MYPAGE_SAVED_SEARCHES, label: '저장한 검색', icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
    ],
  },
  {
    title: '설정',
    items: [
      { href: ROUTES.MYPAGE_EDIT, label: '프로필 수정', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125' },
      { href: ROUTES.MYPAGE_ORGANIZATION, label: '조직·권한', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.053M18 6.75a3 3 0 11-6 0 3 3 0 016 0zM6.75 9.75a3 3 0 11-6 0 3 3 0 016 0z' },
      { href: ROUTES.MYPAGE_VERIFICATION, label: '사업자 인증', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: ROUTES.MYPAGE_NOTIFICATIONS, label: '알림', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
      { href: ROUTES.MYPAGE_PASSWORD, label: '비밀번호', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' },
    ],
  },
];

export default function MyPageRail() {
  const pathname = usePathname();

  return (
    <>
      {/* 데스크탑 sticky rail */}
      <aside className="rail" aria-label="마이페이지 메뉴">
        {SECTIONS.map((sec) => (
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

      {/* 모바일 가로 스크롤 칩 — 주요 섹션만 (B2B 거래 그룹) */}
      <nav aria-label="마이페이지 메뉴 (모바일)" className="lg:hidden -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-1 whitespace-nowrap">
          {[
            { href: ROUTES.MYPAGE_DASHBOARD, label: '대시보드' },
            { href: ROUTES.QUOTATIONS, label: '견적' },
            { href: ROUTES.CONTRACTS, label: '계약' },
            { href: ROUTES.BOOKINGS, label: '예약' },
            { href: ROUTES.SETTLEMENTS, label: '정산' },
            { href: ROUTES.MYPAGE_MESSAGES, label: '메시지' },
            { href: ROUTES.MYPAGE_PORTFOLIOS, label: '포트폴리오' },
            { href: ROUTES.MYPAGE_ORGANIZATION, label: '조직' },
            { href: ROUTES.MYPAGE_EDIT, label: '프로필' },
          ].map((c) => {
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
