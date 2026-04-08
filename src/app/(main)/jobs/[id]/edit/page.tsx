'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import JobForm from '@/features/jobs/components/JobForm';
import { jobService } from '@/features/jobs/services/job-service';
import type { Job } from '@/types/database';
import type { JobFormData } from '@/features/jobs/types';

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const jobId = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const data = await jobService.getJobById(jobId);
      if (!data) {
        setError('존재하지 않는 공고입니다.');
      } else {
        setJob(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '공고를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleSubmit = async (data: JobFormData) => {
    await jobService.updateJob(jobId, data);
    router.push(ROUTES.JOBS_DETAIL(jobId));
  };

  if (loading || authLoading) {
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

  if (error || !job) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{error ?? '공고를 찾을 수 없습니다'}</h2>
          <Link href={ROUTES.JOBS} className="btn-outline text-sm inline-block">목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  if (!profile || profile.id !== job.author_id) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">수정 권한이 없습니다</h2>
          <Link href={ROUTES.JOBS_DETAIL(jobId)} className="btn-outline text-sm inline-block">돌아가기</Link>
        </div>
      </div>
    );
  }

  const initialData: Partial<JobFormData> = {
    postingType: job.posting_type,
    title: job.title,
    description: job.description,
    businessType: job.business_type,
    employmentType: job.employment_type,
    region: job.region,
    salaryInfo: job.salary_info ?? '',
    deadline: job.deadline ? job.deadline.split('T')[0] : '',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.JOBS_DETAIL(jobId)}
          className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200"
          aria-label="돌아가기"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">공고 수정</h1>
      </div>

      <JobForm initialData={initialData} onSubmit={handleSubmit} submitLabel="수정하기" />
    </div>
  );
}
