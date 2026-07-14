import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * 알림 읽음 처리 — 서버(service_role)로 확실히 저장.
 * 클라이언트 .update() 는 세션 토큰 준비 지연·RLS 로 실패해 read_at 이 저장 안 되고
 * 배지(안읽음 카운트)가 안 줄던 문제를 회피한다. 쿠키 profile.id 로 본인 것만 처리.
 *
 * Body: { id } → 해당 알림 1건 읽음 | { all: true } → 내 안읽음 전체 읽음
 */
export async function POST(req: Request) {
  const requestSignal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  try {
    const caller = await getVerifiedProfile(requestSignal);
    if (!caller.ok) {
      if (caller.reason === 'timeout') {
        return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다.' }, { status: 504 });
      }
      if (caller.reason === 'server_error') {
        return NextResponse.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 503 });
      }
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { id, all } = await req.json().catch(() => ({}));
    const supabase = createServiceClient(requestSignal);
    const now = new Date().toISOString();
    let updateError: { message: string } | null = null;

    if (all) {
      const { error } = await supabase.from('notifications').update({ read_at: now })
        .eq('profile_id', caller.profileId).is('read_at', null).is('deleted_at', null)
        .abortSignal(requestSignal);
      updateError = error;
    } else if (id && typeof id === 'string') {
      // 본인 알림만 — profile_id 조건으로 타인 알림 변경 차단
      const { error } = await supabase.from('notifications').update({ read_at: now })
        .eq('id', id).eq('profile_id', caller.profileId).is('read_at', null)
        .abortSignal(requestSignal);
      updateError = error;
    } else {
      return NextResponse.json({ error: '대상이 없습니다.' }, { status: 400 });
    }
    if (updateError) {
      console.error('[api/notifications/read] update failed:', updateError.message);
      return NextResponse.json(
        { error: requestSignal.aborted ? '읽음 처리 시간이 초과되었습니다. 다시 시도해주세요.' : '처리에 실패했습니다.' },
        { status: requestSignal.aborted ? 504 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/notifications/read] failed:', err);
    return NextResponse.json(
      { error: requestSignal.aborted ? '읽음 처리 시간이 초과되었습니다. 다시 시도해주세요.' : '처리에 실패했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
}
