'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { ROUTES } from '@/shared/constants';
import JobForm from '@/features/jobs/components/JobForm';
import type { JobFormData } from '@/features/jobs/types';
import type { Job } from '@/types/database';

// 관리자에는 Supabase 세션이 없어 업로드를 서버 API 경유로 돌린다(대행 등록 화면과 동일).
const UPLOAD_ENDPOINTS = {
  cover: '/api/admin/upload-image?target=job-cover',
  gallery: '/api/admin/upload-image?target=job-gallery',
  content: '/api/admin/upload-image?target=job-content',
};

export default function AdminJobEditClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/jobs?id=${encodeURIComponent(jobId)}`, { credentials: 'include' }, 15000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '공고를 불러오지 못했습니다.');
      setJob(b.job as Job);
    } catch (e) {
      setError(e instanceof Error ? e.message : '공고를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: JobFormData) => {
    const res = await apiFetch('/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'update', id: jobId, ...data }),
    }, 60000);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error || '수정에 실패했습니다.');
    toast('수정했습니다.', 'success');
    router.push(ROUTES.ADMIN_JOBS);
    router.refresh();
  };

  if (loading) return <div className="p-10 text-center text-sm text-gray-400">불러오는 중…</div>;
  if (error || !job) {
    return (
      <div className="platform-panel p-10 text-center">
        <p className="text-sm font-bold text-gray-800">{error ?? '공고를 찾을 수 없습니다.'}</p>
        <Link href={ROUTES.ADMIN_JOBS} className="btn-outline mt-4 inline-block text-sm">목록으로</Link>
      </div>
    );
  }

  const authorLabel = job.author?.company_name || job.author?.contact_name;

  const initialData: Partial<JobFormData> = {
    postingType: job.posting_type,
    title: job.title,
    description: job.description,
    businessType: job.business_type,
    employmentType: job.employment_type,
    region: job.region,
    salaryInfo: job.salary_info ?? '',
    salaryMin: job.salary_min,
    salaryMax: job.salary_max,
    salaryUnit: job.salary_unit,
    experienceMin: job.experience_min,
    deadline: job.deadline ? job.deadline.split('T')[0] : '',
    image: job.image ?? null,
    images: job.images ?? [],
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href={ROUTES.ADMIN_JOBS} className="text-xs font-semibold text-gray-500 hover:text-primary">← 공고 관리</Link>
        <h1 className="mt-1 text-xl font-bold text-ink">공고 수정</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {authorLabel
            ? `${authorLabel} 님의 공고입니다. 저장하면 업체 화면에도 그대로 반영됩니다.`
            : '작성자가 없는 공고입니다.'}
        </p>
        {job.proxy_company_name && (
          <p className="mt-1 text-xs text-amber-700">
            대행 등록 공고입니다. 대행 정보(업체 연락처·동의 기록)는{' '}
            <Link href={`${ROUTES.ADMIN_PROXY_JOBS}/${job.id}/edit`} className="font-bold underline hover:text-primary">대행 공고 수정 화면</Link>
            에서 고칠 수 있습니다.
          </p>
        )}
      </div>

      <JobForm
        initialData={initialData}
        onSubmit={handleSubmit}
        submitLabel="수정 저장"
        uploadEndpoints={UPLOAD_ENDPOINTS}
        onCancel={() => router.push(ROUTES.ADMIN_JOBS)}
        stickyTopClass="top-2"
      />
    </div>
  );
}
