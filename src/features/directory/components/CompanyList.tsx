'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Profile } from '@/types/database';
import { directoryService } from '../services/directory-service';
import type { DirectoryFilters } from '../types';
import CompanyCard from './CompanyCard';
import Pagination from '@/shared/components/Pagination';
import EmptyState from '@/shared/components/EmptyState';

const PAGE_SIZE = 12;

export default function CompanyList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const currentPage = Number(searchParams.get('page') ?? '1');
  const filters: DirectoryFilters = {
    businessType: searchParams.get('businessType') ?? undefined,
    region: searchParams.get('region') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, count } = await directoryService.getProfiles(
        filters,
        currentPage,
        PAGE_SIZE,
      );
      setProfiles(data);
      setTotalCount(count);
    } catch (error) {
      console.error('업체 목록을 불러오는 데 실패했습니다:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="h-6 w-32 bg-secondary rounded" />
              <div className="h-5 w-16 bg-secondary rounded-full" />
            </div>
            <div className="flex gap-4 mb-3">
              <div className="h-4 w-16 bg-secondary rounded" />
              <div className="h-4 w-20 bg-secondary rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-secondary rounded" />
              <div className="h-4 w-3/4 bg-secondary rounded" />
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <div className="h-3 w-16 bg-secondary rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

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
      {/* Result count */}
      <p className="text-sm text-text-secondary mb-4">
        총 <span className="font-semibold text-text-primary">{totalCount}</span>개 업체
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {profiles.map((profile) => (
          <CompanyCard key={profile.id} profile={profile} />
        ))}
      </div>

      {/* Pagination */}
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
