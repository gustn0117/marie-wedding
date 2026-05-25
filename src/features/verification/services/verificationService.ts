'use client';

import { createClient } from '@/lib/supabase/client';
import type { VerificationSubmitRequest } from '@/features/verification/types';

export async function submitVerification(req: VerificationSubmitRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다.' };

  const form = new FormData();
  form.set('businessNumber', req.businessNumber);
  form.set('document', req.documentFile);

  const res = await fetch('/api/verifications/submit', {
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text || '요청이 실패했습니다.' };
  }
  return { ok: true };
}
