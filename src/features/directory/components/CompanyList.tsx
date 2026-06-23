'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import type { Profile } from '@/types/database';
import CompanyCard from './CompanyCard';
import CompanyMobileRow from './CompanyMobileRow';
import Pagination from '@/shared/components/Pagination';
import EmptyState from '@/shared/components/EmptyState';

const PAGE_SIZE = 20;

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
      <div className="platform-toolbar mb-3">
        <p className="text-sm font-semibold text-gray-600" aria-live="polite">
          검색 결과 <span className="font-bold text-primary">{totalCount.toLocaleString()}</span>개 프로필
        </p>
        <span className="trust-pill">인재·업체 프로필</span>
      </div>

      {/* 모바일 1열 compact row */}
      <div className="sm:hidden flex flex-col divide-y divide-gray-100 border border-gray-200 rounded bg-white">
        {profiles.map((profile) => (
          <CompanyMobileRow key={profile.id} profile={profile} />
        ))}
      </div>

      {/* 데스크톱 카드 그리드 */}
      <div className="hidden sm:grid sm:grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {profiles.map((profile) => (
          <CompanyCard key={profile.id} profile={profile} />
        ))}
      </div>

      <div className="mt-6">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
