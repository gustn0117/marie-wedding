'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { isAppTabRoot } from '@/shared/utils/appShell';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import AppBackButton from './AppBackButton';

/**
 * 앱 위 막대(.app-only — 브라우저에서는 웹 머리글이 대신 보인다).
 * - 탭 화면: 왼쪽에 화면 이름(홈은 Marié), 오른쪽에 검색·만들기(+)·알림 아이콘.
 * - 그 밖의 화면: 뒤로 버튼. 화면을 내려 본문 제목(h1)이 막대 밑으로 들어가면 가운데에 그 제목이 떠오른다(iOS 큰 제목처럼).
 * 내리기 시작하면 막대 아래에 가는 선이 생긴다(<header data-scrolled>, globals.css '앱 화면 틀').
 */
interface TabScreen {
  /** null 이면 화면 이름 대신 Marié 글자 */
  title: string | null;
  search?: boolean;
  bell?: boolean;
  create?: { href: string; label: string };
}

const TAB_SCREENS: Record<string, TabScreen> = {
  '/': { title: null, search: true, bell: true },
  '/jobs': { title: '채용정보', search: true, create: { href: ROUTES.JOBS_NEW, label: '공고 등록' } },
  '/directory': { title: '인재·업체', search: true, create: { href: ROUTES.DIRECTORY_REGISTER, label: '프로필 등록' } },
  '/community': { title: '커뮤니티', search: true, create: { href: ROUTES.COMMUNITY_NEW, label: '글쓰기' } },
  '/mypage': { title: '마이', bell: true },
};

const SEARCH_ICON = 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z';
const PLUS_ICON = 'M12 4.5v15m7.5-7.5h-15';

/** 본문의 첫 '보이는' 제목 — 숨긴(display:none) 머리나 화면 읽기 전용(sr-only) 제목은 건너뛴다 */
function firstVisibleHeading(): HTMLElement | null {
  const list = document.querySelectorAll<HTMLElement>('main h1');
  for (const h of list) {
    if (h.classList.contains('sr-only')) continue;
    if (h.getClientRects().length > 0) return h;
  }
  return null;
}

export default function AppNavBar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname() || '/';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const tab = isAppTabRoot(path) ? TAB_SCREENS[path] ?? null : null;
  const barRef = useRef<HTMLDivElement>(null);
  const [pageTitle, setPageTitle] = useState('');

  useEffect(() => {
    const header = barRef.current?.closest('header');
    if (!header || !document.documentElement.hasAttribute('data-app')) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      header.toggleAttribute('data-scrolled', window.scrollY > 2);
      if (tab) {
        setPageTitle('');
        return;
      }
      const heading = firstVisibleHeading();
      const passed = !!heading && heading.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom;
      setPageTitle(passed && heading ? (heading.textContent ?? '').replace(/\s+/g, ' ').trim() : '');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tab, pathname]);

  return (
    <div ref={barRef} className="app-only relative flex h-[var(--header-row-h)] items-center px-1.5">
      {tab ? (
        <>
          <div className="min-w-0 flex-1 pl-2.5">
            {tab.title ? (
              <p className="truncate text-[22px] font-extrabold tracking-tight text-ink">{tab.title}</p>
            ) : (
              <p className="text-[25px] font-bold leading-none tracking-tight text-ink">Marié</p>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            {tab.search && <NavIconLink href={ROUTES.SEARCH} label="검색" icon={SEARCH_ICON} />}
            {tab.create && <NavIconLink href={tab.create.href} label={tab.create.label} icon={PLUS_ICON} />}
            {tab.bell && isAuthenticated && <NotificationBell variant="link" />}
          </div>
        </>
      ) : (
        <>
          <AppBackButton />
          <p
            aria-hidden={!pageTitle}
            className={`pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold text-ink transition-opacity duration-200 ${
              pageTitle ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {pageTitle}
          </p>
        </>
      )}
    </div>
  );
}

function NavIconLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex h-11 w-11 items-center justify-center text-ink">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
    </Link>
  );
}
