'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import ChipNav, { type ChipItem } from '@/shared/components/ChipNav';
import { BUSINESS_TYPES, ROUTES } from '@/shared/constants';

export default function DirectoryRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentBiz = sp.get('businessType') ?? '';
  const isList = pathname === ROUTES.DIRECTORY || pathname === '/directory';

  const items: ChipItem[] = [
    { href: ROUTES.DIRECTORY, label: '전체', active: isList && !currentBiz },
    ...BUSINESS_TYPES.map((b) => ({
      href: `${ROUTES.DIRECTORY}?businessType=${b.value}`,
      label: b.label,
      active: currentBiz === b.value,
    })),
  ];

  // 앱에서는 목록 화면에서만 업종 탭을 보인다 — 프로필 상세 위에 붙으면 웹 메뉴처럼 보인다.
  return <ChipNav items={items} className={isList ? '' : 'app-hide'} />;
}
