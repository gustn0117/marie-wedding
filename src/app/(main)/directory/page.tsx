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
  title: '인재·업체 프로필 | Marié',
  description: '웨딩 업계 인재와 업체 프로필을 업종, 지역별로 검색할 수 있습니다.',
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
  // region 은 콤마-구분 다중값으로 저장될 수 있음 ("seoul,gyeonggi").
  // .in() 은 완전 일치만 매칭 → 다중지역 프로필이 필터에서 누락되던 버그를
  // ilike '%X%' 로 통일해 부분 매칭으로 해결. (business_type 도 같은 방식)
  if (searchParams.subRegion) {
    const subs = searchParams.subRegion.split(',').map((r) => r.trim()).filter(Boolean);
    if (subs.length > 0) {
      const orPart = subs.map((r) => `region.ilike.%${r}%`).join(',');
      query = query.or(orPart);
    }
  } else if (searchParams.region) {
    const details = REGION_DETAILS[searchParams.region]?.map((d) => d.value) ?? [];
    const all = [searchParams.region, ...details];
    const orPart = all.map((r) => `region.ilike.%${r}%`).join(',');
    query = query.or(orPart);
  }
  if (searchParams.search) {
    const term = normalizeSearchTerm(searchParams.search);
    if (term) {
      query = query.or(`company_name.ilike.%${term}%,contact_name.ilike.%${term}%`);
    }
  }

  // 정렬: 프리미엄 → 진행 이력 → 인증 업체 → 가나다순
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
        eyebrow="프로필"
        title="인재·업체 프로필"
        description={`웨딩홀·드레스·스튜디오·메이크업 등 채용 전 확인할 프로필 · 등록 프로필 ${count.toLocaleString()}개 · 선택 조건 ${activeFilterCount}개`}
        actions={
          <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-primary text-sm">+ 프로필 등록</Link>
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
