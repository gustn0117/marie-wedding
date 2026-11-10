'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { isAppTabRoot } from '@/shared/utils/appShell';

/**
 * 앱 아래 탭 — iOS 앱에서 첫 화면들(홈·채용정보·인재·업체·커뮤니티·마이)에만 보인다(.app-only).
 * 상세·글쓰기 같은 화면에서는 탭 대신 머리글의 뒤로 버튼으로 돌아온다(그 화면들의 아래 고정 버튼과 겹치지 않게).
 * 보이는 동안 <html data-app-tabbar> 를 달아 본문·알림 토스트가 탭 높이만큼 위로 비키게 한다(globals.css).
 */
const TABS = [
  { href: ROUTES.HOME, label: '홈', icon: 'M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
  { href: ROUTES.JOBS, label: '채용정보', icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0' },
  { href: ROUTES.DIRECTORY, label: '인재·업체', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
  { href: ROUTES.COMMUNITY, label: '커뮤니티', icon: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155' },
  { href: ROUTES.MYPAGE, label: '마이', icon: 'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z' },
] as const;

export default function AppTabBar() {
  const pathname = usePathname();
  const visible = isAppTabRoot(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute('data-app')) return;
    if (visible) root.setAttribute('data-app-tabbar', '');
    else root.removeAttribute('data-app-tabbar');
  }, [visible]);

  if (!visible) return null;

  return (
    <nav
      aria-label="앱 메뉴"
      className="app-only fixed inset-x-0 bottom-0 z-sidebar border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-14 grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.href === ROUTES.HOME ? pathname === '/' : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] leading-none ${
                  active ? 'font-bold text-primary' : 'font-medium text-gray-500'
                }`}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 1.9 : 1.5} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
