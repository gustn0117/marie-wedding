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

// 관리자에는 Supabase 세션이 없어 업로드를 서버 API 경유로 돌린다(등록 화면과 동일).
const UPLOAD_ENDPOINTS = {
  cover: '/api/admin/upload-image?target=job-cover',
  gallery: '/api/admin/upload-image?target=job-gallery',
  content: '/api/admin/upload-image?target=job-content',
};

export default function AdminProxyJobEditClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [contact, setContact] = useState('');
  const [consentNote, setConsentNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/proxy-jobs?id=${encodeURIComponent(jobId)}`, { credentials: 'include' }, 15000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '공고를 불러오지 못했습니다.');
      const j = b.job as Job;
      setJob(j);
      setCompanyName(j.proxy_company_name ?? '');
      setContact(j.proxy_contact ?? '');
      setConsentNote(j.proxy_consent_note ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '공고를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: JobFormData) => {
    // 등록 화면과 같은 규칙. 서버도 막지만 여기서 먼저 걸러 되돌아가기 쉽게 한다.
    if (!companyName.trim() || !contact.trim() || consentNote.trim().length < 5) {
      toast('업체명·연락처·동의 경위를 확인해주세요.', 'error');
      throw new Error('대행 정보 미입력');
    }
    const res = await apiFetch('/api/admin/proxy-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'update',
        id: jobId,
        companyName: companyName.trim(),
        contact: contact.trim(),
        consentNote: consentNote.trim(),
        ...data,
      }),
    }, 60000);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error || '수정에 실패했습니다.');
    toast('수정했습니다.', 'success');
    router.push(ROUTES.ADMIN_PROXY_JOBS);
    router.refresh();
  };

  if (loading) return <div className="p-10 text-center text-sm text-gray-400">불러오는 중…</div>;
  if (error || !job) {
    return (
      <div className="platform-panel p-10 text-center">
        <p className="text-sm font-bold text-gray-800">{error ?? '공고를 찾을 수 없습니다.'}</p>
        <Link href={ROUTES.ADMIN_PROXY_JOBS} className="btn-outline mt-4 inline-block text-sm">목록으로</Link>
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
        <Link href={ROUTES.ADMIN_PROXY_JOBS} className="text-xs font-semibold text-gray-500 hover:text-primary">← 대행 등록 공고</Link>
        <h1 className="mt-1 text-xl font-bold text-ink">대행 공고 수정</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {job.author_id
            ? '이미 업체가 가져간 공고입니다. 수정하면 업체 화면에도 그대로 반영됩니다.'
            : '아직 업체가 가져가지 않은 공고입니다.'}
        </p>
      </div>

      <div className="platform-panel space-y-3 p-5">
        <h2 className="text-sm font-bold text-ink">대행 정보</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-gray-500">업체명 *</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-field mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500">업체 연락처 *</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} className="input-field mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500">동의를 받은 경위 * (법적 근거로 남습니다)</label>
          <textarea value={consentNote} onChange={(e) => setConsentNote(e.target.value)} rows={2} className="input-field mt-1 resize-y" />
        </div>
      </div>

      <JobForm
        initialData={initialData}
        onSubmit={handleSubmit}
        submitLabel="수정 저장"
        uploadEndpoints={UPLOAD_ENDPOINTS}
        onCancel={() => router.push(ROUTES.ADMIN_PROXY_JOBS)}
        stickyTopClass="top-2"
      />
    </div>
  );
}
