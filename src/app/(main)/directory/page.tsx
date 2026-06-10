import { Suspense } from 'react';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import CompanyList from '@/features/directory/components/CompanyList';
import type { Profile } from '@/types/database';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';
import PageHeader from '@/shared/components/PageHeader';

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
      <PageHeader
        eyebrow="업체 디렉토리"
        title="업체 디렉토리"
        description={`웨딩홀·드레스·스튜디오·메이크업 등 협업 파트너 탐색 · 등록 업체 ${count.toLocaleString()}개 · 선택 조건 ${activeFilterCount}개`}
        actions={
          <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-primary text-sm">+ 업체 등록</Link>
        }
      />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="surface animate-pulse h-48" />
            ))}
          </div>
        }
      >
        <CompanyList initialProfiles={profiles} initialCount={count} />
      </Suspense>
    </div>
  );
}
