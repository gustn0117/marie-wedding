import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 메시지 전송 — send_message RPC 를 서버(쿠키 세션)로 호출.
 * start 와 동일한 이유(클라 세션 토큰 의존 제거)로 서버 라우트 경유.
 */
export async function POST(req: Request) {
  try {
    const { conversationId, body } = await req.json();
    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json({ error: '대화가 올바르지 않습니다.' }, { status: 400 });
    }
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) {
      return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    // 제재(banned) 유저는 쪽지 전송 차단 (다른 write 라우트와 동일 가드).
    const service = createServiceClient();
    const { data: me } = await service.from('profiles').select('banned_at').eq('user_id', user.id).maybeSingle();
    if (me?.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

    const { data, error } = await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_body: text,
    });
    if (error) {
      console.error('[api/messages/send] rpc error:', error.message);
      const msg = error.message.includes('unauthorized') ? '로그인이 필요합니다.' : '메시지 전송에 실패했습니다.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[api/messages/send] failed:', err);
    return NextResponse.json({ error: '메시지 전송에 실패했습니다.' }, { status: 500 });
  }
}
