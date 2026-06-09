'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import ChipNav, { type ChipItem } from '@/shared/components/ChipNav';
import { BUSINESS_TYPES, ROUTES } from '@/shared/constants';

export default function JobsRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentBiz = sp.get('businessType') ?? '';
  const currentType = sp.get('type') ?? '';
  const isList = pathname === ROUTES.JOBS || pathname === '/jobs';

  const items: ChipItem[] = [
    { href: ROUTES.JOBS, label: '전체', active: isList && !currentBiz && !currentType },
    { href: `${ROUTES.JOBS}?type=matching`, label: '파트너 섭외', active: currentType === 'matching' },
    ...BUSINESS_TYPES.map((b) => ({
      href: `${ROUTES.JOBS}?businessType=${b.value}`,
      label: b.label,
      active: currentBiz === b.value,
    })),
  ];

  return <ChipNav items={items} />;
}
