import type { ReactNode } from 'react';
import { Suspense } from 'react';
import JobsRail from '@/features/jobs/components/JobsRail';

/**
 * 채용 정보 워크스페이스 — 좌측 rail + 본문.
 * /jobs 리스트만 rail 적용. /jobs/[id], /jobs/new 같은 디테일/폼은 wrapping에서 제외하기 위해
 * children이 자체 폭을 선택할 수 있게 leave 가능.
 */
export default function JobsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
      <Suspense fallback={<div className="hidden lg:block" />}>
        <JobsRail />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
