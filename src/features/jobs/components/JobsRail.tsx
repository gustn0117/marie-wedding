'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import ChipNav, { type ChipItem } from '@/shared/components/ChipNav';
import { BUSINESS_TYPES, ROUTES } from '@/shared/constants';

export default function JobsRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentBiz = sp.get('businessType') ?? '';
  const isList = pathname === ROUTES.JOBS || pathname === '/jobs';

  const items: ChipItem[] = [
    { href: ROUTES.JOBS, label: '전체 채용', active: isList && !currentBiz },
    ...BUSINESS_TYPES.map((b) => ({
      href: `${ROUTES.JOBS}?businessType=${b.value}`,
      label: b.label,
      active: currentBiz === b.value,
    })),
  ];

  return <ChipNav items={items} />;
}
