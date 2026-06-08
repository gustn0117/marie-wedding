import type { ReactNode } from 'react';
import { Suspense } from 'react';
import CommunityRail from '@/features/community/components/CommunityRail';

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
      <Suspense fallback={<div className="hidden lg:block" />}>
        <CommunityRail />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
