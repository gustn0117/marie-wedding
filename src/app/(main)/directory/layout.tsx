import type { ReactNode } from 'react';
import { Suspense } from 'react';
import DirectoryRail from '@/features/directory/components/DirectoryRail';

export default function DirectoryLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div className="h-10 mb-4" />}>
        <DirectoryRail />
      </Suspense>
      {children}
    </div>
  );
}
