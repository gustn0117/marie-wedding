'use client';

import { useRef } from 'react';
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
  // 응답 유실 후 재시도에도 같은 PK를 보내 중복 공고 생성을 막는다.
  const createIdRef = useRef<string | null>(null);

  const handleSubmit = async (data: JobFormData) => {
    const createId = createIdRef.current ?? crypto.randomUUID();
    createIdRef.current = createId;
    await jobService.createJob(data, profileId, createId);
    router.push(ROUTES.JOBS);
    router.refresh();
  };

  return <JobForm onSubmit={handleSubmit} submitLabel="등록하기" />;
}
