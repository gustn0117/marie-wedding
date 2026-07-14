import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;
const COMMENT_SELECT = 'id, post_id, author_id, content, created_at, updated_at, deleted_at, author:profiles!author_id(id, company_name, contact_name, profile_image)';

/**
 * 댓글 작성 (service_role) — 클라이언트 .insert().select().single() 의
 * RLS/세션토큰 hang 회피. 작성자는 SSR 세션에서 서버가 판별.
 * Body: { id, postId, content }
 */
export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  let body: { id?: string; postId?: string; content?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const postId = body.postId;
  const content = (body.content ?? '').trim();
  const commentId = body.id?.trim();
  if (!postId || !content) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: '댓글은 2000자 이하로 입력해주세요.' }, { status: 400 });
  }
  if (!isUuid(commentId)) {
    return NextResponse.json({ error: '유효한 생성 ID가 필요합니다.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(SUPABASE_SERVER_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, requestSignal])
          : requestSignal,
      }),
    },
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
    },
  });
  const { data: { user }, error: authError } = await ssr.auth.getUser();
  if (authError && requestSignal.aborted) {
    return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 });
  }
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient(requestSignal);
  const { data: me, error: profileError } = await service
    .from('profiles')
    .select('id, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .abortSignal(requestSignal)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: requestSignal.aborted ? '댓글 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

  const { data, error } = await service
    .from('comments')
    .insert({ id: commentId, post_id: postId, content, author_id: me.id })
    .select(COMMENT_SELECT)
    .abortSignal(requestSignal)
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: replayError } = await service
        .from('comments')
        .select(COMMENT_SELECT)
        .eq('id', commentId)
        .abortSignal(requestSignal)
        .maybeSingle();
      if (replayError) {
        return NextResponse.json(
          { error: requestSignal.aborted ? '댓글 저장 결과 확인이 지연되고 있습니다.' : '댓글 저장 결과를 확인하지 못했습니다.' },
          { status: requestSignal.aborted ? 504 : 500 },
        );
      }
      const sameContext = !!existing
        && existing.author_id === me.id
        && existing.post_id === postId
        && !existing.deleted_at;
      if (sameContext && existing.content === content) {
        return NextResponse.json({ data: existing, replayed: true });
      }
      return NextResponse.json({
        error: sameContext
          ? '같은 생성 ID로 이미 다른 내용의 댓글이 등록되었습니다. 댓글 목록을 확인해주세요.'
          : '이미 사용된 생성 ID입니다.',
      }, { status: 409 });
    }
    return NextResponse.json(
      { error: requestSignal.aborted ? '댓글 저장 시간이 초과되었습니다. 댓글 목록을 확인한 뒤 다시 시도해주세요.' : error.message },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  return NextResponse.json({ data });
}
