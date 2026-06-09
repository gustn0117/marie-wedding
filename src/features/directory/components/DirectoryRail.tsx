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

  return <ChipNav items={items} />;
}
