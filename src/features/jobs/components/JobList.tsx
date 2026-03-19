'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Job } from '@/types/database';
import type { JobFilters } from '../types';
import { jobService } from '../services/job-service';
import JobCard from './JobCard';
import Pagination from '@/shared/components/Pagination';
import EmptyState from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants';

const PAGE_SIZE = 12;

export default function JobList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPage = Number(searchParams.get('page')) || 1;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const filters: JobFilters = {
    businessType: searchParams.get('businessType') ?? undefined,
    employmentType: searchParams.get('employmentType') ?? undefined,
    region: searchParams.get('region') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await jobService.getJobs(filters, currentPage, PAGE_SIZE);
      setJobs(result.data);
      setTotalCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : '채용 공고를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5 animate-pulse space-y-3">
            <div className="flex gap-2">
              <div className="h-6 w-14 rounded-full bg-secondary" />
              <div className="h-6 w-16 rounded-full bg-secondary" />
            </div>
            <div className="h-6 w-3/4 rounded bg-secondary" />
            <div className="h-4 w-1/2 rounded bg-secondary" />
            <div className="h-4 w-1/3 rounded bg-secondary" />
            <div className="pt-3 border-t border-border">
              <div className="h-3 w-16 rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={fetchJobs} className="btn-outline text-sm">
          다시 시도
        </button>
      </div>
    );
  }

  // Empty state
  if (jobs.length === 0) {
    return (
      <EmptyState
        title="등록된 채용 공고가 없습니다"
        description="조건에 맞는 채용 공고가 없습니다. 필터를 변경하거나 새 공고를 등록해보세요."
        actionLabel="공고 등록하기"
        actionHref={ROUTES.JOBS_NEW}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Result Count */}
      <p className="text-sm text-text-muted">
        총 <span className="font-semibold text-text-primary">{totalCount}</span>건의 공고
      </p>

      {/* Job Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
