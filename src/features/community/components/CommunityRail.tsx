'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import ChipNav, { type ChipItem } from '@/shared/components/ChipNav';
import { POST_CATEGORIES, ROUTES } from '@/shared/constants';

export default function CommunityRail() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentCategory = sp.get('category') ?? '';
  const isList = pathname === ROUTES.COMMUNITY || pathname === '/community';

  const items: ChipItem[] = [
    { href: ROUTES.COMMUNITY, label: '전체', active: isList && !currentCategory },
    ...POST_CATEGORIES.map((cat) => ({
      href: `${ROUTES.COMMUNITY}?category=${cat.value}`,
      label: cat.label,
      active: currentCategory === cat.value,
    })),
  ];

  return <ChipNav items={items} />;
}
