import type { ReactNode } from 'react';
import { Suspense } from 'react';
import CommunityRail from '@/features/community/components/CommunityRail';

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div className="h-10 mb-4" />}>
        <CommunityRail />
      </Suspense>
      {children}
    </div>
  );
}
