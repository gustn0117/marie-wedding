'use client';

import { apiFetch } from '@/shared/utils/apiFetch';

export async function decideVerification(
  profileId: string,
  decision: 'verified' | 'rejected',
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiFetch('/api/admin/verifications/decide', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profileId, decision, reason }),
  }, 12000);
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    return {
      ok: false,
      error: typeof body?.error === 'string' ? body.error : '인증 처리에 실패했습니다.',
    };
  }
  return { ok: true };
}

export async function getDocumentSignedUrl(path: string): Promise<string | null> {
  try {
    const res = await apiFetch(
      `/api/admin/verifications/decide?path=${encodeURIComponent(path)}`,
      { cache: 'no-store' },
      12000,
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null) as { signedUrl?: unknown } | null;
    return typeof body?.signedUrl === 'string' ? body.signedUrl : null;
  } catch {
    return null;
  }
}
