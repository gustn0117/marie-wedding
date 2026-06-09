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
    { href: `${ROUTES.EVENTS}?type=promotion`, label: '프로모션', active: currentType === 'promotion' },
    { href: `${ROUTES.EVENTS}?type=contest`, label: '공모전', active: currentType === 'contest' },
    { href: `${ROUTES.EVENTS}?type=webinar`, label: '웨비나', active: currentType === 'webinar' },
    { href: `${ROUTES.EVENTS}?type=news`, label: '소식', active: currentType === 'news' },
  ];

  return <ChipNav items={items} />;
}
