import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WRITE_TIMEOUT_MS = 10_000;

/**
 * 게시글 수정 API (service_role).
 * QA-010 재발 방지 — 클라이언트 .update().select().single() 이 auto_moderate 트리거로
 * RETURNING 이 null 되는 케이스 우회. 본인 또는 admin 만 허용.
 */
export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(WRITE_TIMEOUT_MS)]);
  let body: { id?: string; title?: string; content?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });

  const title = (body.title ?? '').trim();
  const content = (body.content ?? '').trim();
  const category = (body.category ?? '').trim();

  if (!title || !content || !category) {
    return NextResponse.json({ error: '제목·내용·카테고리는 필수입니다.' }, { status: 400 });
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
        getAll() { return cookieStore.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    },
  );

  const { data: { user }, error: authError } = await ssr.auth.getUser();
  if (authError && requestSignal.aborted) {
    return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 });
  }
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient();

  const [meResult, postResult] = await Promise.all([
    service.from('profiles').select('id, role, banned_at').eq('user_id', user.id).is('deleted_at', null).abortSignal(requestSignal).maybeSingle(),
    service.from('posts').select('id, author_id, deleted_at').eq('id', id).abortSignal(requestSignal).maybeSingle(),
  ]);
  const { data: me, error: meError } = meResult;
  const { data: post, error: postError } = postResult;
  if (meError || postError) {
    console.error('[posts/update] lookup failed:', { meError, postError });
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '게시글 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  if (post.deleted_at) return NextResponse.json({ error: '이미 삭제된 게시글입니다.' }, { status: 410 });

  const canManage = me.id === post.author_id || me.role === 'admin';
  if (!canManage) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const { error: updateErr } = await service
    .from('posts')
    .update({ title, content, category, updated_at: new Date().toISOString() })
    .eq('id', id)
    .abortSignal(requestSignal);
  if (updateErr) {
    console.error('[posts/update] failed:', updateErr);
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : `수정에 실패했습니다: ${updateErr.message}` },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  return NextResponse.json({ success: true, post: { id } });
}
