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
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={ROUTES.JOBS_EDIT(jobId)}
        aria-label="공고 수정"
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-gray-200 bg-white text-[12.5px] font-semibold text-gray-700 hover:border-ink hover:text-ink transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
        </svg>
        수정하기
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="공고 삭제"
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-gray-200 bg-white text-[12.5px] font-semibold text-gray-700 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/40 transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        {deleting ? '삭제 중…' : '삭제하기'}
      </button>
    </div>
  );
}
