import { Suspense } from 'react';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import CompanyFilters from '@/features/directory/components/CompanyFilters';
import CompanyList from '@/features/directory/components/CompanyList';
import type { Profile } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '업체 디렉토리 | Marié',
  description: '웨딩 업계 파트너를 찾아보세요. 업종, 지역별로 검색할 수 있습니다.',
};

async function getInitialProfiles() {
  const supabase = createServerQueryClient();
  const { data, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('company_name', { ascending: true })
    .range(0, 11);

  return { profiles: (data ?? []) as Profile[], count: count ?? 0 };
}

export default async function DirectoryPage() {
  const { profiles, count } = await getInitialProfiles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">업체 디렉토리</h1>
        <p className="mt-1.5 text-sm text-text-secondary">웨딩 업계 파트너를 찾아보세요</p>
      </div>

      <Suspense fallback={<div className="card h-20 animate-pulse bg-secondary" />}>
        <CompanyFilters />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
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
