import { Suspense } from 'react';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import JobsPageContent from '@/features/jobs/components/JobsPageContent';
import type { Job } from '@/types/database';
import { REGION_DETAILS } from '@/shared/constants/regions';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '채용정보 | 마리에',
  description: '웨딩 업계 채용 공고를 확인하고 지원하세요.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
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
  const needsInnerAuthor = searchParams.completed === '1';
  const authorEmbed = needsInnerAuthor
    ? `author:profiles!author_id!inner(${PUBLIC_PROFILE_COLUMNS})`
    : `author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS})`;

  let query = supabase
    .from('jobs')
    .select(`*, ${authorEmbed}`, { count: 'exact' })
    .is('deleted_at', null)
    .eq('hidden_by_admin', false)
    .eq('posting_type', 'hiring');

  // 기본 가드: 'hidden'만 제외 (admin이 명시적으로 숨긴 것).
  // closed/filled는 최근 등록된 공고가 자동 closed로 잡혀도 사용자 인지를 위해 노출.
  // 카드/리스트에서 "마감" 배지로 시각 구분됨 (getJobTier + isExpired).
  query = query.neq('status', 'hidden');

  // 마감일이 지난 공고 제외 (deadline IS NULL 이거나 deadline >= now).
  // 서버(DB)에서 필터해야 count와 실제 반환 행이 동일한 조건을 보므로
  // 총건수 과표시·페이지당 결손·빈 페이지 문제가 생기지 않는다.
  // .or()는 top-level jobs 컬럼에 적용되며 기존 .eq/.neq/.in 및 author!inner 임베드와 AND로 결합된다.
  if (!searchParams.includeClosed) {
    query = query.or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`);
  }

  if (searchParams.businessType) {
    const types = searchParams.businessType.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) query = query.in('business_type', types);
  }
  if (searchParams.employmentType) {
    query = query.eq('employment_type', searchParams.employmentType);
  }
  // region 은 콤마-구분 다중값·'전국(all)' 가능 → 완전일치(.in) 대신 ilike 부분매칭.
  // '전국' 공고(region 에 all 포함)는 어느 지역 필터에도 노출.
  if (searchParams.subRegion) {
    const subRegions = searchParams.subRegion.split(',').map((r) => r.trim()).filter(Boolean);
    if (subRegions.length > 0) {
      const orPart = [...subRegions.map((r) => `region.ilike.%${r}%`), 'region.ilike.%all%'].join(',');
      query = query.or(orPart);
    }
  } else if (searchParams.region) {
    const details = REGION_DETAILS[searchParams.region]?.map((detail) => detail.value) ?? [];
    const all = [searchParams.region, ...details];
    const orPart = [...all.map((r) => `region.ilike.%${r}%`), 'region.ilike.%all%'].join(',');
    query = query.or(orPart);
  }
  if (searchParams.search) {
    query = query.ilike('title', `%${searchParams.search}%`);
  }
  if (searchParams.completed === '1') {
    query = query.gt('author.completed_deals_count', 0);
  }
  // 급여 필터 UI 는 '월 XXX만원~'(월급, 만원 단위)다. salary_min/max 를 단위 무시하고 숫자로만
  // 비교하면 시급(원 단위, 예 15,000)·일급 공고가 월급 필터를 오염시킨다. 월급 공고로 한정한다.
  if (searchParams.salaryMin || searchParams.salaryMax) {
    query = query.eq('salary_unit', 'monthly');
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
  } else {
    // recent (default)
    query = query
      .order('is_promoted', { ascending: false })
      .order('created_at', { ascending: false });
  }

  query = query.range(from, to);

  const { data, count } = await query;
  // 동적 !inner 임베드 문자열은 supabase-js 타입 파서가 런타임에 유효한
  // PostgREST select도 ParserError로 추론하므로 실제 응답 타입으로 좁힌다.
  const jobs = (data ?? []) as unknown as Job[];

  return { jobs, count: count ?? 0 };
}

export default async function JobsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const { jobs, count } = await getJobs(resolvedSearchParams);

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
