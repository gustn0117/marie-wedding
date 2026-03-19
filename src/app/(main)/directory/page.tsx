import { Suspense } from 'react';
import CompanyFilters from '@/features/directory/components/CompanyFilters';
import CompanyList from '@/features/directory/components/CompanyList';

export const metadata = {
  title: '업체 디렉토리 | Marié',
  description: '웨딩 업계 파트너를 찾아보세요. 업종, 지역별로 검색할 수 있습니다.',
};

export default function DirectoryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">
          업체 디렉토리
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          웨딩 업계 파트너를 찾아보세요
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={<div className="card h-20 animate-pulse bg-secondary" />}>
        <CompanyFilters />
      </Suspense>

      {/* Company List */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse h-48" />
            ))}
          </div>
        }
      >
        <CompanyList />
      </Suspense>
    </div>
  );
}
