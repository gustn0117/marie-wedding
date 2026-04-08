'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { jobService } from '@/features/jobs/services/job-service';
import JobForm from './JobForm';
import type { JobFormData } from '../types';

interface JobEditFormProps {
  jobId: string;
  initialData: Partial<JobFormData>;
}

export default function JobEditForm({ jobId, initialData }: JobEditFormProps) {
  const router = useRouter();

  const handleSubmit = async (data: JobFormData) => {
    await jobService.updateJob(jobId, data);
    router.push(ROUTES.JOBS_DETAIL(jobId));
  };

  return <JobForm initialData={initialData} onSubmit={handleSubmit} submitLabel="수정하기" />;
}
