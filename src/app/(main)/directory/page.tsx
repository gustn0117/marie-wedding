import { Suspense } from 'react';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import CompanyFilters from '@/features/directory/components/CompanyFilters';
import CompanyList from '@/features/directory/components/CompanyList';
import type { Profile } from '@/types/database';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '업체 디렉토리 | Marié',
  description: '웨딩 업계 파트너를 찾아보세요. 업종, 지역별로 검색할 수 있습니다.',
};

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

async function getProfiles(searchParams: Record<string, string | undefined>) {
  const supabase = createServerQueryClient();
  const page = Number(searchParams.page) || 1;
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_directory_listed', true);

  if (searchParams.businessType) {
    const types = searchParams.businessType.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) {
      const orPart = types
        .map((t) => `business_type.ilike.%${normalizeSearchTerm(t)}%`)
        .filter((s) => !s.includes('ilike.%%'))
        .join(',');
      if (orPart) query = query.or(orPart);
    }
  }
  if (searchParams.subRegion) {
    const subs = searchParams.subRegion.split(',').map((r) => r.trim()).filter(Boolean);
    if (subs.length > 0) query = query.in('region', subs);
  } else if (searchParams.region) {
    const details = REGION_DETAILS[searchParams.region]?.map((d) => d.value) ?? [];
    query = query.in('region', [searchParams.region, ...details]);
  }
  if (searchParams.search) {
    const term = normalizeSearchTerm(searchParams.search);
    if (term) {
      query = query.or(`company_name.ilike.%${term}%,contact_name.ilike.%${term}%`);
    }
  }

  // 정렬: 프리미엄 → 거래 검증 → 인증 업체 → 가나다순
  query = query
    .order('premium_tier', { ascending: false, nullsFirst: false })
    .order('completed_deals_count', { ascending: false })
    .order('verified_at', { ascending: false, nullsFirst: false })
    .order('company_name', { ascending: true })
    .range(from, to);

  const { data, count } = await query;
  return { profiles: (data ?? []) as Profile[], count: count ?? 0 };
}

export default async function DirectoryPage({ searchParams }: PageProps) {
  const { profiles, count } = await getProfiles(searchParams);
  const activeFilterCount = ['businessType', 'region', 'search'].filter((key) => searchParams[key]).length;

  return (
    <div className="space-y-4">
      <section className="platform-hero">
        <div className="platform-hero-grid">
          <div className="platform-hero-copy">
            <div>
            <p className="platform-eyebrow">Company Directory</p>
            <h1 className="platform-hero-title">업체 디렉토리</h1>
            <p className="platform-hero-text">
              웨딩홀, 드레스, 스튜디오, 메이크업 등 협업 가능한 파트너를 업종과 지역별로 탐색하세요.
            </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="platform-stat-card">
                <span className="platform-stat-label">등록 업체</span>
                <span className="platform-stat-value">{count.toLocaleString()}개</span>
              </div>
              <div className="platform-stat-card">
                <span className="platform-stat-label">선택 조건</span>
                <span className="platform-stat-value">{activeFilterCount.toLocaleString()}개</span>
              </div>
            </div>
          </div>
          <div className="platform-panel-soft p-3">
            <p className="text-[12px] font-bold text-gray-500">파트너 운영</p>
            <div className="mt-3 grid gap-2">
              <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-primary w-full">
                업체 등록
              </Link>
              <Link href={`${ROUTES.JOBS}?type=matching`} className="btn-secondary w-full">
                섭외 공고 보기
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <Suspense
          fallback={<div className="hidden lg:block h-[400px] bg-gray-100 rounded-sm animate-pulse" />}
        >
          <CompanyFilters />
        </Suspense>
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="card animate-pulse h-48" />
              ))}
            </div>
          }
        >
          <CompanyList initialProfiles={profiles} initialCount={count} />
        </Suspense>
      </div>
    </div>
  );
}
