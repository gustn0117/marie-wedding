'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import ChipNav, { type ChipItem } from '@/shared/components/ChipNav';
import { ROUTES } from '@/shared/constants';

export default function EventsRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentType = sp.get('type') ?? '';
  const isList = pathname === ROUTES.EVENTS || pathname === '/events';

  const items: ChipItem[] = [
    { href: ROUTES.EVENTS, label: '전체', active: isList && !currentType },
    { href: `${ROUTES.EVENTS}?type=event`, label: '웨딩박람회', active: currentType === 'event' },
    { href: `${ROUTES.EVENTS}?type=news`, label: '채용행사', active: currentType === 'news' },
    { href: `${ROUTES.EVENTS}?type=notice`, label: '업계소식', active: currentType === 'notice' },
  ];

  // 앱에서는 목록 화면에서만 종류 탭을 보인다 — 행사 상세 위에 붙으면 웹 메뉴처럼 보인다.
  return <ChipNav items={items} className={isList ? '' : 'app-hide'} />;
}
