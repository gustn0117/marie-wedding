'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { ROUTES } from '@/shared/constants';
import JobForm from '@/features/jobs/components/JobForm';
import type { JobFormData } from '@/features/jobs/types';

/**
 * 대행 공고 등록 — 사용자용 JobForm 을 그대로 쓴다.
 *
 * 관리자 화면에는 Supabase 로그인 세션이 없다. 스토리지 정책이 authenticated 한정이라
 * 클라이언트 직접 업로드는 실패하므로, 이미지 업로드를 전부 관리자 API 경유로 돌린다.
 */
const UPLOAD_ENDPOINTS = {
  cover: '/api/admin/upload-image?target=job-cover',
  gallery: '/api/admin/upload-image?target=job-gallery',
  content: '/api/admin/upload-image?target=job-content',
};

export default function AdminProxyJobNewClient() {
  const router = useRouter();
  // 대행 전용 정보 — JobFormData 에 없는 값이라 폼 바깥에서 받는다.
  const [companyName, setCompanyName] = useState('');
  const [contact, setContact] = useState('');
  const [consentNote, setConsentNote] = useState('');

  const handleSubmit = async (data: JobFormData) => {
    if (!companyName.trim() || !contact.trim() || consentNote.trim().length < 5) {
      toast('업체명·연락처·동의 경위를 먼저 채워주세요.', 'error');
      // 위쪽 입력으로 되돌려 보낸다.
      document.getElementById('proxy-meta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      throw new Error('대행 정보 미입력');
    }

    const res = await apiFetch('/api/admin/proxy-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'create',
        companyName: companyName.trim(),
        contact: contact.trim(),
        consentNote: consentNote.trim(),
        ...data,
      }),
    }, 60000);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error || '등록에 실패했습니다.');

    toast(`등록했습니다. 업체 전달 코드: ${b.claimCode}`, 'success');
    router.push(ROUTES.ADMIN_PROXY_JOBS);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href={ROUTES.ADMIN_PROXY_JOBS} className="text-xs font-semibold text-gray-500 hover:text-primary">← 대행 등록 공고</Link>
        <h1 className="mt-1 text-xl font-bold text-ink">대행 공고 등록</h1>
        <p className="mt-0.5 text-xs text-gray-500">사용자가 등록하는 화면과 동일합니다. 업체 동의를 받은 공고만 등록하세요.</p>
      </div>

      <div id="proxy-meta" className="platform-panel space-y-3 p-5">
        <h2 className="text-sm font-bold text-ink">대행 정보</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-gray-500">업체명 *</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              placeholder="예) 강남 OO웨딩홀" className="input-field mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500">업체 연락처 *</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="예) 02-000-0000 / 담당 김실장" className="input-field mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500">동의를 받은 경위 * (법적 근거로 남습니다)</label>
          <textarea value={consentNote} onChange={(e) => setConsentNote(e.target.value)} rows={2}
            placeholder="예) 2026-07-26 전화 통화, 예약실 김○○ 실장이 공고 대신 등록에 동의"
            className="input-field mt-1 resize-y" />
          <p className="mt-1 text-[11px] text-gray-400">
            동의 없이 다른 사이트의 공고를 옮겨오면 데이터베이스제작자 권리 침해입니다(서울고법, 잡코리아 대 사람인).
          </p>
        </div>
      </div>

      <JobForm
        onSubmit={handleSubmit}
        submitLabel="대행 등록하고 코드 발급"
        uploadEndpoints={UPLOAD_ENDPOINTS}
        onCancel={() => router.push(ROUTES.ADMIN_PROXY_JOBS)}
        stickyTopClass="top-2"
      />
    </div>
  );
}
