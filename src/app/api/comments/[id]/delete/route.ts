import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * 댓글 soft delete API. 본인 또는 admin만 허용. service_role로 update.
 *
 * 클라이언트 직접 update 는, 브라우저 supabase 세션이 만료됐는데 marie_profile
 * 쿠키만 살아있는 상태에서 RLS(auth.uid()=NULL)에 걸려 0행 갱신되고도 에러 없이
 * '삭제됨'으로 오표시되던 문제가 있었다. 쿠키로 getUser() 재인증 후 서버에서 처리해
 * 실패 시 non-ok 로 정확히 오류를 낸다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user }, error: authError } = await ssr.auth.getUser();
  if (authError && requestSignal.aborted) {
    return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 });
  }
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient(requestSignal);

  const [profileResult, commentResult] = await Promise.all([
    service.from('profiles').select('id, role').eq('user_id', user.id).abortSignal(requestSignal).maybeSingle(),
    service.from('comments').select('id, author_id, deleted_at').eq('id', id).abortSignal(requestSignal).maybeSingle(),
  ]);
  const { data: profile, error: profileError } = profileResult;
  const { data: comment, error: commentError } = commentResult;

  if (profileError || commentError) {
    return NextResponse.json(
      { error: requestSignal.aborted ? '댓글 삭제 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '댓글 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  if (!profile) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  }
  if (!comment) {
    return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (comment.deleted_at) {
    return NextResponse.json({ error: '이미 삭제된 댓글입니다.' }, { status: 410 });
  }

  const canManage = profile.id === comment.author_id || profile.role === 'admin';
  if (!canManage) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { error } = await service
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .abortSignal(requestSignal);

  if (error) {
    return NextResponse.json(
      { error: requestSignal.aborted ? '댓글 삭제 시간이 초과되었습니다. 현재 상태를 다시 확인해주세요.' : `댓글 삭제에 실패했습니다: ${error.message}` },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  return NextResponse.json({ success: true });
}
