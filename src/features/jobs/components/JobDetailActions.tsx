'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { jobService } from '@/features/jobs/services/job-service';
import { revalidate } from '@/shared/utils/revalidate';
import { withTimeout } from '@/shared/utils/withTimeout';

interface JobDetailActionsProps {
  jobId: string;
  authorId: string;
}

export default function JobDetailActions({ jobId, authorId }: JobDetailActionsProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const canManage = !!profile && (profile.id === authorId || profile.role === 'admin');
  if (!canManage) return null;

  const handleDelete = async () => {
    if (!confirm('정말로 이 공고를 삭제하시겠습니까? 삭제 후에는 복구할 수 없어요.')) return;
    setDeleting(true);
    try {
      await withTimeout(jobService.deleteJob(jobId), 10000);
      // revalidate는 best-effort — hang해도 navigation은 즉시
      revalidate('/', ROUTES.JOBS).catch(() => {});
      router.push(ROUTES.JOBS);
      router.refresh();
    } catch (err) {
      console.error('[JobDetailActions] delete failed:', err);
      alert(err instanceof Error ? `삭제에 실패했습니다.\n${err.message}` : '삭제에 실패했습니다.');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="border-t border-gray-100" />
      <div className="p-6 md:p-8 flex items-center gap-3">
        <Link href={ROUTES.JOBS_EDIT(jobId)} className="btn-outline text-sm px-5 py-2.5">수정하기</Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-5 py-2.5 text-sm font-bold text-state-urgent border border-red-200 rounded hover:bg-state-urgent-bg transition-colors disabled:opacity-50"
        >
          {deleting ? '삭제 중...' : '삭제하기'}
        </button>
      </div>
    </>
  );
}
