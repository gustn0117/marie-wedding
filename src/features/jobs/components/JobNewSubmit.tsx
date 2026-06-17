'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { jobService } from '@/features/jobs/services/job-service';
import JobForm from './JobForm';
import { revalidate } from '@/shared/utils/revalidate';
import type { JobFormData } from '../types';

interface JobNewSubmitProps {
  profileId: string;
}

export default function JobNewSubmit({ profileId }: JobNewSubmitProps) {
  const router = useRouter();

  const handleSubmit = async (data: JobFormData) => {
    await jobService.createJob(data, profileId);
    await revalidate('/', ROUTES.JOBS);
    router.push(ROUTES.JOBS);
    router.refresh();
  };

  return <JobForm onSubmit={handleSubmit} submitLabel="등록하기" />;
}
