import { Suspense } from 'react';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import JobsPageContent from '@/features/jobs/components/JobsPageContent';
import type { Job } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '채용정보 | 마리에',
  description: '웨딩 업계 채용 공고를 확인하고 지원하세요.',
};

async function getInitialJobs() {
  const supabase = createServerQueryClient();
  const { data, count } = await supabase
    .from('jobs')
    .select('*, author:profiles!author_id(*)', { count: 'exact' })
    .is('deleted_at', null)
    .order('is_urgent', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, 19);

  return { jobs: (data ?? []) as Job[], count: count ?? 0 };
}

export default async function JobsPage() {
  const { jobs, count } = await getInitialJobs();

  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto px-4 py-6 animate-pulse space-y-4">
          <div className="h-10 w-full bg-gray-100 rounded" />
          <div className="h-[400px] w-full bg-gray-100 rounded" />
        </div>
      }
    >
      <JobsPageContent initialJobs={jobs} initialCount={count} />
    </Suspense>
  );
}
