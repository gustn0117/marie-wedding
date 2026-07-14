import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * 알림 목록 + 안읽음 수 — service_role 서버 조회(내부 kong 직결).
 * 헤더 알림벨이 이걸 쓴다. 마이페이지 알림 페이지와 동일 소스라 내용이 일치하고,
 * 클라이언트 supabase(RLS/Cloudflare 세션토큰 대기) hang·빈결과 문제를 우회한다.
 */
export async function GET(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(requestSignal);
  if (!caller.ok) {
    if (caller.reason === 'timeout') {
      return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다.' }, { status: 504 });
    }
    if (caller.reason === 'server_error') {
      return NextResponse.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const profileId = caller.profileId;

  const supabase = createServiceClient(requestSignal);
  const [itemsRes, countRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, message, link_url, read_at, created_at')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
      .abortSignal(requestSignal),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .is('read_at', null)
      .is('deleted_at', null)
      .abortSignal(requestSignal),
  ]);

  if (itemsRes.error || countRes.error) {
    console.error('[api/notifications/list] failed:', itemsRes.error ?? countRes.error);
    return NextResponse.json(
      { error: requestSignal.aborted ? '알림 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '알림을 불러오지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  return NextResponse.json({ items: itemsRes.data ?? [], unreadCount: countRes.count ?? 0 });
}
