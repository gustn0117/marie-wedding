import { Suspense } from 'react';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import CompanyFilters from '@/features/directory/components/CompanyFilters';
import CompanyList from '@/features/directory/components/CompanyList';
import type { Profile } from '@/types/database';

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
  const pageSize = 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_directory_listed', true);

  if (searchParams.businessType) {
    query = query.ilike('business_type', `%${searchParams.businessType}%`);
  }
  if (searchParams.region) {
    query = query.ilike('region', `%${searchParams.region}%`);
  }
  if (searchParams.search) {
    query = query.or(`company_name.ilike.%${searchParams.search}%,contact_name.ilike.%${searchParams.search}%`);
  }

  query = query.order('company_name', { ascending: true }).range(from, to);

  const { data, count } = await query;
  return { profiles: (data ?? []) as Profile[], count: count ?? 0 };
}

export default async function DirectoryPage({ searchParams }: PageProps) {
  const { profiles, count } = await getProfiles(searchParams);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">업체 디렉토리</h1>
          <p className="mt-1.5 text-sm text-text-secondary">웨딩 업계 파트너를 찾아보세요</p>
        </div>
        <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-primary text-sm px-5 py-2.5 rounded-lg shrink-0">
          업체 등록하기
        </Link>
      </div>

      <Suspense fallback={<div className="card h-20 animate-pulse bg-secondary" />}>
        <CompanyFilters />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card animate-pulse h-48" />
            ))}
          </div>
        }
      >
        <CompanyList initialProfiles={profiles} initialCount={count} />
      </Suspense>
    </div>
  );
}
