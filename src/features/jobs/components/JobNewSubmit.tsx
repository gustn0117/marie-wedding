'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { jobService } from '@/features/jobs/services/job-service';
import JobForm from './JobForm';
import type { JobFormData } from '../types';

interface JobNewSubmitProps {
  profileId: string;
}

export default function JobNewSubmit({ profileId }: JobNewSubmitProps) {
  const router = useRouter();

  const handleSubmit = async (data: JobFormData) => {
    await jobService.createJob(data, profileId);
    router.push(ROUTES.JOBS);
  };

  return <JobForm onSubmit={handleSubmit} submitLabel="등록하기" />;
}
