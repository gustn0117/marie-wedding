import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 대화 시작(찾기/생성) — start_conversation RPC 를 서버(쿠키 세션)로 호출.
 * 클라이언트 직접 RPC 는 세션 토큰 준비 지연/누락 시 auth.uid() 가 NULL 이 되어
 * 'unauthorized' 로 실패하거나 느렸다. 서버 세션 클라이언트는 내부 kong 직결이라
 * 빠르고 auth.uid() 가 안정적으로 잡힌다.
 */
export async function POST(req: Request) {
  try {
    const { targetProfileId } = await req.json();
    if (!targetProfileId || typeof targetProfileId !== 'string') {
      return NextResponse.json({ error: '대상이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    // 제재(banned) 유저는 대화 시작 차단.
    const service = createServiceClient();
    const { data: me } = await service.from('profiles').select('banned_at').eq('user_id', user.id).maybeSingle();
    if (me?.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

    const { data, error } = await supabase.rpc('start_conversation', { p_other_profile_id: targetProfileId });
    if (error) {
      console.error('[api/messages/start] rpc error:', error.message);
      const msg = error.message.includes('unauthorized')
        ? '로그인이 필요합니다.'
        : error.message.includes('cannot_message_self')
          ? '본인에게는 쪽지를 보낼 수 없습니다.'
          : '대화 시작에 실패했습니다.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[api/messages/start] failed:', err);
    return NextResponse.json({ error: '대화 시작에 실패했습니다.' }, { status: 500 });
  }
}
