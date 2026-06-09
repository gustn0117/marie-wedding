import type { ReactNode } from 'react';
import { Suspense } from 'react';
import JobsRail from '@/features/jobs/components/JobsRail';

export default function JobsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div className="h-10 mb-4" />}>
        <JobsRail />
      </Suspense>
      {children}
    </div>
  );
}
