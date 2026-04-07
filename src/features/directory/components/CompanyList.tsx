'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import type { Profile } from '@/types/database';
import CompanyCard from './CompanyCard';
import Pagination from '@/shared/components/Pagination';
import EmptyState from '@/shared/components/EmptyState';

const PAGE_SIZE = 12;

interface CompanyListProps {
  initialProfiles?: Profile[];
  initialCount?: number;
}

export default function CompanyList({ initialProfiles, initialCount }: CompanyListProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const profiles = initialProfiles ?? [];
  const totalCount = initialCount ?? 0;
  const currentPage = Number(searchParams.get('page') ?? '1');
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  };

  if (profiles.length === 0) {
    return (
      <EmptyState
        title="등록된 업체가 없습니다"
        description="검색 조건을 변경하거나 필터를 초기화해 보세요."
      />
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        총 <span className="font-semibold text-gray-900">{totalCount}</span>개 업체
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {profiles.map((profile) => (
          <CompanyCard key={profile.id} profile={profile} />
        ))}
      </div>

      <div className="mt-8">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
