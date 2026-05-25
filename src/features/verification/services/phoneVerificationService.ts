'use client';

import { createClient } from '@/lib/supabase/client';

async function withAuth(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function requestPhoneOtp(phone: string): Promise<{ ok: true; expiresInMinutes: number } | { ok: false; error: string }> {
  const token = await withAuth();
  if (!token) return { ok: false, error: '로그인이 필요합니다.' };
  const res = await fetch('/api/phone-verification/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  const json = await res.json();
  return { ok: true, expiresInMinutes: json.expiresInMinutes };
}

export async function verifyPhoneOtp(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await withAuth();
  if (!token) return { ok: false, error: '로그인이 필요합니다.' };
  const res = await fetch('/api/phone-verification/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}
