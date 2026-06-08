import type { ReactNode } from 'react';
import { Suspense } from 'react';
import DirectoryRail from '@/features/directory/components/DirectoryRail';

export default function DirectoryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
      <Suspense fallback={<div className="hidden lg:block" />}>
        <DirectoryRail />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
