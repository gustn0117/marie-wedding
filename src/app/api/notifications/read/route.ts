import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 알림 읽음 처리 — 서버(service_role)로 확실히 저장.
 * 클라이언트 .update() 는 세션 토큰 준비 지연·RLS 로 실패해 read_at 이 저장 안 되고
 * 배지(안읽음 카운트)가 안 줄던 문제를 회피한다. 쿠키 profile.id 로 본인 것만 처리.
 *
 * Body: { id } → 해당 알림 1건 읽음 | { all: true } → 내 안읽음 전체 읽음
 */
export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const pc = cookieStore.get('marie_profile');
    if (!pc?.value) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    let me: { id?: string } | null = null;
    try { me = JSON.parse(pc.value); } catch { me = null; }
    if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { id, all } = await req.json().catch(() => ({}));
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    if (all) {
      await supabase.from('notifications').update({ read_at: now })
        .eq('profile_id', me.id).is('read_at', null).is('deleted_at', null);
    } else if (id && typeof id === 'string') {
      // 본인 알림만 — profile_id 조건으로 타인 알림 변경 차단
      await supabase.from('notifications').update({ read_at: now })
        .eq('id', id).eq('profile_id', me.id).is('read_at', null);
    } else {
      return NextResponse.json({ error: '대상이 없습니다.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/notifications/read] failed:', err);
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 });
  }
}
