import { Suspense } from 'react';
import JobsPageContent from '@/features/jobs/components/JobsPageContent';

export const metadata = {
  title: '채용정보 | 마리에',
  description: '웨딩 업계 채용 공고를 확인하고 지원하세요.',
};

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto px-4 py-6 animate-pulse space-y-4">
          <div className="h-10 w-full bg-gray-100 rounded" />
          <div className="h-[400px] w-full bg-gray-100 rounded" />
        </div>
      }
    >
      <JobsPageContent />
    </Suspense>
  );
}
