import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 알림 목록 + 안읽음 수 — service_role 서버 조회(내부 kong 직결).
 * 헤더 알림벨이 이걸 쓴다. 마이페이지 알림 페이지와 동일 소스라 내용이 일치하고,
 * 클라이언트 supabase(RLS/Cloudflare 세션토큰 대기) hang·빈결과 문제를 우회한다.
 */
export async function GET() {
  const pc = cookies().get('marie_profile');
  let profileId: string | null = null;
  try { if (pc?.value) profileId = JSON.parse(pc.value)?.id ?? null; } catch { /* noop */ }
  if (!profileId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const [itemsRes, countRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, message, link_url, read_at, created_at')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .is('read_at', null)
      .is('deleted_at', null),
  ]);

  return NextResponse.json({ items: itemsRes.data ?? [], unreadCount: countRes.count ?? 0 });
}
