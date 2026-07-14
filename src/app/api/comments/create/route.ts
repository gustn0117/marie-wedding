import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 댓글 작성 (service_role) — 클라이언트 .insert().select().single() 의
 * RLS/세션토큰 hang 회피. 작성자는 SSR 세션에서 서버가 판별.
 * Body: { postId, content }
 */
export async function POST(request: Request) {
  let body: { postId?: string; content?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const postId = body.postId;
  const content = (body.content ?? '').trim();
  if (!postId || !content) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: '댓글은 2000자 이하로 입력해주세요.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(SUPABASE_SERVER_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
    },
  });
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient();
  const { data: me } = await service
    .from('profiles')
    .select('id, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

  const { data, error } = await service
    .from('comments')
    .insert({ post_id: postId, content, author_id: me.id })
    .select('*, author:profiles!author_id(*)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
