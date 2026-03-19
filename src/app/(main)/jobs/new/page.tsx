'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import JobForm from '@/features/jobs/components/JobForm';
import { jobService } from '@/features/jobs/services/job-service';
import type { JobFormData } from '@/features/jobs/types';

export default function NewJobPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  const handleSubmit = async (data: JobFormData) => {
    if (!profile) {
      throw new Error('로그인이 필요합니다.');
    }

    await jobService.createJob(data, profile.id);
    router.push(ROUTES.JOBS);
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 rounded bg-secondary" />
          <div className="card p-8 space-y-4">
            <div className="h-10 rounded bg-secondary" />
            <div className="h-32 rounded bg-secondary" />
            <div className="h-10 rounded bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  // Auth guard
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h2 className="font-serif text-lg font-semibold text-text-primary">
            로그인이 필요합니다
          </h2>
          <p className="text-sm text-text-secondary">
            채용 공고를 등록하려면 로그인해주세요.
          </p>
          <Link href={ROUTES.LOGIN} className="btn-primary text-sm px-6 py-2.5 inline-block">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.JOBS}
          className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200"
          aria-label="목록으로 돌아가기"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="font-serif text-2xl font-bold text-text-primary">공고 등록</h1>
      </div>

      {/* Form */}
      <JobForm onSubmit={handleSubmit} submitLabel="등록하기" />
    </div>
  );
}
