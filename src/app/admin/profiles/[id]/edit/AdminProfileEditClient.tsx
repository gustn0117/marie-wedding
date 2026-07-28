'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { ROUTES } from '@/shared/constants';
import DirectoryForm, { type DirectoryFormValues } from '@/features/directory/components/DirectoryForm';
import { PROXY_UPLOAD_ENDPOINTS } from '../../../proxy-profiles/ProxyMetaPanel';
import { toListingPayload } from '../../../proxy-profiles/payload';
import type { Profile } from '@/types/database';

/**
 * 회원 프로필 수정 — 사용자용 DirectoryForm 을 그대로 쓴다.
 * 저장·업로드만 관리자 API 로 갈아끼운다(관리자 화면에는 Supabase 세션이 없다).
 * 계정 정보(휴대폰·권한·공개 여부)는 이 화면에서 다루지 않는다.
 */
export default function AdminProfileEditClient({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/profiles?id=${encodeURIComponent(profileId)}`, { credentials: 'include' }, 15000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '프로필을 불러오지 못했습니다.');
      setProfile(b.profile as Profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : '프로필을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (values: DirectoryFormValues) => {
    const res = await apiFetch('/api/admin/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'update', id: profileId, ...toListingPayload(values) }),
    }, 30000);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error || '수정에 실패했습니다.');
    toast('수정했습니다.', 'success');
    router.push(ROUTES.ADMIN_USERS);
    router.refresh();
  };

  if (loading) return <div className="p-10 text-center text-sm text-gray-400">불러오는 중…</div>;
  if (error || !profile) {
    return (
      <div className="platform-panel p-10 text-center">
        <p className="text-sm font-bold text-gray-800">{error ?? '프로필을 찾을 수 없습니다.'}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={ROUTES.ADMIN_USERS} className="btn-outline inline-block text-sm">회원 관리</Link>
          <Link href={ROUTES.ADMIN_PROXY_PROFILES} className="btn-outline inline-block text-sm">대행 등록 프로필</Link>
        </div>
      </div>
    );
  }

  const name = profile.company_name || profile.contact_name;

  return (
    <div className="space-y-4">
      <div>
        <Link href={ROUTES.ADMIN_USERS} className="text-xs font-semibold text-gray-500 hover:text-primary">← 회원 관리</Link>
        <h1 className="mt-1 text-xl font-bold text-ink">회원 프로필 수정</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {name} 님의 공개 프로필입니다. 저장하면 회원 화면과 디렉토리에 바로 반영됩니다.
        </p>
      </div>

      <DirectoryForm
        profile={profile}
        proxy={{
          onSave: handleSave,
          uploadEndpoints: PROXY_UPLOAD_ENDPOINTS,
          cancelHref: ROUTES.ADMIN_USERS,
          submitLabel: '수정 저장',
        }}
      />
    </div>
  );
}
