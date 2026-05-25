'use client';

import { createClient } from '@/lib/supabase/client';

export async function decideVerification(
  profileId: string,
  decision: 'verified' | 'rejected',
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다.' };

  const res = await fetch('/api/admin/verifications/decide', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ profileId, decision, reason }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

export async function getDocumentSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from('verifications').createSignedUrl(path, 60 * 10);
  if (error || !data) return null;
  return data.signedUrl;
}
