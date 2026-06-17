'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { jobService } from '@/features/jobs/services/job-service';
import JobForm from './JobForm';
import { revalidate } from '@/shared/utils/revalidate';
import type { JobFormData } from '../types';

interface JobEditFormProps {
  jobId: string;
  initialData: Partial<JobFormData>;
}

export default function JobEditForm({ jobId, initialData }: JobEditFormProps) {
  const router = useRouter();

  const handleSubmit = async (data: JobFormData) => {
    await jobService.updateJob(jobId, data);
    // 홈·목록·상세 모두 서버 캐시 무효화 (다음 진입 시 fresh)
    await revalidate('/', ROUTES.JOBS, ROUTES.JOBS_DETAIL(jobId));
    router.push(ROUTES.JOBS_DETAIL(jobId));
    router.refresh();
  };

  return <JobForm initialData={initialData} onSubmit={handleSubmit} submitLabel="수정하기" />;
}
