'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { ROUTES } from '@/shared/constants';
import DirectoryForm, { type DirectoryFormValues } from '@/features/directory/components/DirectoryForm';
import ProxyMetaPanel, { PROXY_UPLOAD_ENDPOINTS, type ProxyMeta } from '../ProxyMetaPanel';
import { blankProxyProfile, toProxyPayload } from '../payload';

/**
 * 대행 프로필 등록 — 사용자용 DirectoryForm 을 그대로 쓴다.
 * 저장·업로드만 관리자 API 로 갈아끼운다(관리자 화면에는 Supabase 세션이 없다).
 */
export default function AdminProxyProfileNewClient() {
  const router = useRouter();
  const [meta, setMeta] = useState<ProxyMeta>({ contact: '', consentNote: '' });

  const handleSave = async (values: DirectoryFormValues) => {
    if (!meta.contact.trim() || meta.consentNote.trim().length < 5) {
      toast('업체 연락처와 동의 경위를 먼저 채워주세요.', 'error');
      document.getElementById('proxy-meta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      throw new Error('대행 정보 미입력');
    }

    const res = await apiFetch('/api/admin/proxy-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'create', ...toProxyPayload(values, meta) }),
    }, 30000);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error || '등록에 실패했습니다.');

    toast('등록했습니다. 디렉토리에 바로 노출됩니다.', 'success');
    router.push(ROUTES.ADMIN_PROXY_PROFILES);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href={ROUTES.ADMIN_PROXY_PROFILES} className="text-xs font-semibold text-gray-500 hover:text-primary">← 대행 등록 프로필</Link>
        <h1 className="mt-1 text-xl font-bold text-ink">대행 프로필 등록</h1>
        <p className="mt-0.5 text-xs text-gray-500">사용자가 등록하는 화면과 동일합니다. 업체 동의를 받은 곳만 등록하세요.</p>
      </div>

      <ProxyMetaPanel value={meta} onChange={setMeta} />

      <DirectoryForm
        profile={blankProxyProfile()}
        proxy={{
          onSave: handleSave,
          uploadEndpoints: PROXY_UPLOAD_ENDPOINTS,
          cancelHref: ROUTES.ADMIN_PROXY_PROFILES,
          submitLabel: '대행 등록하기',
        }}
      />
    </div>
  );
}
