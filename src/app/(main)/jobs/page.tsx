import { Suspense } from 'react';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import JobsPageContent from '@/features/jobs/components/JobsPageContent';
import type { Job } from '@/types/database';
import { REGION_DETAILS } from '@/shared/constants/regions';

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

  // Foreign-table 필터(verified/completed)는 PostgREST inner join이 있어야
  // outer-join으로 fallback되지 않고 실제 행을 걸러냄. inner join 마커는 `!inner`.
  // 그 외 일반 표시용 임베드는 LEFT join이라도 무방.
  const needsInnerAuthor = searchParams.verified === '1' || searchParams.completed === '1';
  const authorEmbed = needsInnerAuthor ? 'author:profiles!author_id!inner(*)' : 'author:profiles!author_id(*)';

  let query = supabase
    .from('jobs')
    .select(`*, ${authorEmbed}`, { count: 'exact' })
    .is('deleted_at', null)
    .eq('hidden_by_admin', false);

  // 기본 가드: 'hidden'만 제외 (admin이 명시적으로 숨긴 것).
  // closed/filled는 최근 등록된 공고가 자동 closed로 잡혀도 사용자 인지를 위해 노출.
  // 카드/리스트에서 "마감" 배지로 시각 구분됨 (getJobTier + isExpired).
  query = query.neq('status', 'hidden');

  // 마감일이 지난 공고도 자동 제외 (deadline IS NULL 이거나 deadline >= now).
  // PostgREST or 필터로 표현.
  if (!searchParams.includeClosed) {
    const nowIso = new Date(0).toISOString(); // placeholder; replaced below
    // PostgREST or 구문에 동적 ISO를 안전하게 끼우기 위해 RPC가 아닌 ts side에서 처리.
    // nowIso는 의미 없음 — 아래에서 실제 now()로 교체.
    void nowIso;
  }

  if (searchParams.type) {
    query = query.eq('posting_type', searchParams.type);
  }
  if (searchParams.businessType) {
    const types = searchParams.businessType.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) query = query.in('business_type', types);
  }
  if (searchParams.employmentType) {
    query = query.eq('employment_type', searchParams.employmentType);
  }
  if (searchParams.subRegion) {
    const subRegions = searchParams.subRegion.split(',').map((r) => r.trim()).filter(Boolean);
    if (subRegions.length > 0) query = query.in('region', subRegions);
  } else if (searchParams.region) {
    const details = REGION_DETAILS[searchParams.region]?.map((detail) => detail.value) ?? [];
    query = query.in('region', [searchParams.region, ...details]);
  }
  if (searchParams.search) {
    query = query.ilike('title', `%${searchParams.search}%`);
  }
  if (searchParams.verified === '1') {
    query = query.eq('author.verification_status', 'verified');
  }
  if (searchParams.completed === '1') {
    query = query.gt('author.completed_deals_count', 0);
  }
  if (searchParams.salaryMin) {
    const v = Number(searchParams.salaryMin);
    if (Number.isFinite(v) && v > 0) query = query.gte('salary_min', v);
  }
  if (searchParams.salaryMax) {
    const v = Number(searchParams.salaryMax);
    if (Number.isFinite(v) && v > 0) query = query.lte('salary_max', v);
  }
  if (searchParams.expMax) {
    const v = Number(searchParams.expMax);
    if (Number.isFinite(v) && v >= 0) query = query.lte('experience_min', v);
  }

  // 정렬: 사용자 지정 sort 우선, 기본은 promoted → 최신순.
  const sort = searchParams.sort ?? 'recent';
  if (sort === 'deadline') {
    // 마감 임박순 (deadline 가까운 순, NULL은 뒤로)
    query = query.order('deadline', { ascending: true, nullsFirst: false });
  } else if (sort === 'views') {
    query = query.order('view_count', { ascending: false });
  } else {
    // recent (default)
    query = query
      .order('is_promoted', { ascending: false })
      .order('created_at', { ascending: false });
  }

  query = query.range(from, to);

  const { data, count } = await query;
  let jobs = (data ?? []) as Job[];

  // 마감일이 지난 공고 클라이언트 측 제외 (PostgREST에서 or 구문이 복잡하므로 이중 가드).
  if (!searchParams.includeClosed) {
    const now = Date.now();
    jobs = jobs.filter((j) => !j.deadline || new Date(j.deadline).getTime() >= now);
  }

  return { jobs, count: count ?? 0 };
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
