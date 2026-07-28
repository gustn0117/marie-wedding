'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { ROUTES } from '@/shared/constants';
import DirectoryForm, { type DirectoryFormValues } from '@/features/directory/components/DirectoryForm';
import ProxyMetaPanel, { PROXY_UPLOAD_ENDPOINTS, type ProxyMeta } from '../../ProxyMetaPanel';
import { toProxyPayload } from '../../payload';
import type { Profile } from '@/types/database';

export default function AdminProxyProfileEditClient({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meta, setMeta] = useState<ProxyMeta>({ contact: '', consentNote: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/proxy-profiles?id=${encodeURIComponent(profileId)}`, { credentials: 'include' }, 15000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '프로필을 불러오지 못했습니다.');
      const p = b.profile as Profile & { proxy_contact?: string | null; proxy_consent_note?: string | null };
      setProfile(p);
      setMeta({ contact: p.proxy_contact ?? '', consentNote: p.proxy_consent_note ?? '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '프로필을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (values: DirectoryFormValues) => {
    if (!meta.contact.trim() || meta.consentNote.trim().length < 5) {
      toast('업체 연락처와 동의 경위를 확인해주세요.', 'error');
      document.getElementById('proxy-meta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      throw new Error('대행 정보 미입력');
    }
    const res = await apiFetch('/api/admin/proxy-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'update', id: profileId, ...toProxyPayload(values, meta) }),
    }, 30000);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error || '수정에 실패했습니다.');
    toast('수정했습니다.', 'success');
    router.push(ROUTES.ADMIN_PROXY_PROFILES);
    router.refresh();
  };

  if (loading) return <div className="p-10 text-center text-sm text-gray-400">불러오는 중…</div>;
  if (error || !profile) {
    return (
      <div className="platform-panel p-10 text-center">
        <p className="text-sm font-bold text-gray-800">{error ?? '프로필을 찾을 수 없습니다.'}</p>
        <Link href={ROUTES.ADMIN_PROXY_PROFILES} className="btn-outline mt-4 inline-block text-sm">목록으로</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={ROUTES.ADMIN_PROXY_PROFILES} className="text-xs font-semibold text-gray-500 hover:text-primary">← 대행 등록 프로필</Link>
        <h1 className="mt-1 text-xl font-bold text-ink">대행 프로필 수정</h1>
        <p className="mt-0.5 text-xs text-gray-500">디렉토리에 공개 중인 내용입니다. 저장하면 바로 반영됩니다.</p>
      </div>

      <ProxyMetaPanel value={meta} onChange={setMeta} />

      <DirectoryForm
        profile={profile}
        proxy={{
          onSave: handleSave,
          uploadEndpoints: PROXY_UPLOAD_ENDPOINTS,
          cancelHref: ROUTES.ADMIN_PROXY_PROFILES,
          submitLabel: '수정 저장',
        }}
      />
    </div>
  );
}
