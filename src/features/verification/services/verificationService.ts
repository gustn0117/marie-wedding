'use client';

import { apiFetch } from '@/shared/utils/apiFetch';
import type { VerificationSubmitRequest } from '@/features/verification/types';

export async function submitVerification(req: VerificationSubmitRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.set('businessNumber', req.businessNumber);
  form.set('document', req.documentFile);

  // 인증은 HttpOnly Supabase 세션 쿠키로 서버에서 확인한다.
  // 클라이언트 getSession 왕복과 호출부의 중복 Promise timeout 을 없애고,
  // 실제 fetch 한 곳에서만 AbortController 로 요청을 중단한다.
  const res = await apiFetch('/api/verifications/submit', {
    method: 'POST',
    body: form,
  }, 45000);

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text || '요청이 실패했습니다.' };
  }
  return { ok: true };
}
