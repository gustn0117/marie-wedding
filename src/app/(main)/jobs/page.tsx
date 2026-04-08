import { Suspense } from 'react';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import JobsPageContent from '@/features/jobs/components/JobsPageContent';
import type { Job } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '채용정보 | 마리에',
  description: '웨딩 업계 채용 공고를 확인하고 지원하세요.',
};

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

async function getJobs(searchParams: Record<string, string | undefined>) {
  const supabase = createServerQueryClient();
  const page = Number(searchParams.page) || 1;
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('jobs')
    .select('*, author:profiles!author_id(*)', { count: 'exact' })
    .is('deleted_at', null);

  if (searchParams.type) {
    query = query.eq('posting_type', searchParams.type);
  }
  if (searchParams.businessType) {
    const types = searchParams.businessType.split(',');
    const orFilter = types.map(t => `business_type.ilike.%${t}%`).join(',');
    query = query.or(orFilter);
  }
  if (searchParams.employmentType) {
    query = query.eq('employment_type', searchParams.employmentType);
  }
  if (searchParams.region) {
    query = query.ilike('region', `%${searchParams.region}%`);
  }
  if (searchParams.search) {
    query = query.ilike('title', `%${searchParams.search}%`);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, count } = await query;
  return { jobs: (data ?? []) as Job[], count: count ?? 0 };
}

export default async function JobsPage({ searchParams }: PageProps) {
  const { jobs, count } = await getJobs(searchParams);

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
