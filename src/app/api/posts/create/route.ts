import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WRITE_TIMEOUT_MS = 10_000;

/**
 * 게시글 등록 API (service_role).
 *
 * 배경: 클라이언트에서 .insert().select().maybeSingle() 시 RLS readback 또는
 *      moderation trigger 영향으로 data=null 이 반환되어 UI가 '실패' 로 인식하지만
 *      실제 DB엔 row 가 저장되는 케이스가 있어 QA-010 으로 보고됨.
 *
 * 대응: service_role 로 ID를 선확정해 INSERT. 인증된 사용자만 본인 명의로 작성 가능.
 */
export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(WRITE_TIMEOUT_MS)]);
  let body: { id?: string; title?: string; content?: string; category?: string; region?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  const content = (body.content ?? '').trim();
  const category = (body.category ?? '').trim();
  const region = body.region?.trim() || null;
  const postId = body.id?.trim();

  if (!title || !content || !category) {
    return NextResponse.json({ error: '제목·내용·카테고리는 필수입니다.' }, { status: 400 });
  }
  if (!isUuid(postId)) {
    return NextResponse.json({ error: '유효한 생성 ID가 필요합니다.' }, { status: 400 });
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

  const service = createServiceClient();
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, onboarded_at, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .abortSignal(requestSignal)
    .maybeSingle();

  if (profileError) {
    console.error('[posts/create] requester lookup failed:', profileError);
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  if (!profile) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  }
  // 제재된 계정은 service_role write 경로로도 작성 불가 (미들웨어 /api 예외 보완)
  if (profile.banned_at) {
    return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });
  }
  if (!profile.onboarded_at) {
    return NextResponse.json({ error: '온보딩이 필요합니다.' }, { status: 403 });
  }

  const createInput = {
    id: postId,
    title,
    content,
    category,
    region,
    author_id: profile.id,
    is_notice: false,
  };
  // 폼에서 고정한 생성 ID를 사용해 commit 후 응답 유실 재시도를 멱등하게 만든다.
  const { error } = await service
    .from('posts')
    .insert(createInput)
    .abortSignal(requestSignal);

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: replayError } = await service
        .from('posts')
        .select('id, author_id, title, content, category, region, is_notice, deleted_at')
        .eq('id', postId)
        .abortSignal(requestSignal)
        .maybeSingle();
      if (replayError) {
        console.error('[posts/create] replay lookup failed:', replayError);
        return NextResponse.json(
          { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '등록 결과를 확인하지 못했습니다.' },
          { status: requestSignal.aborted ? 504 : 500 },
        );
      }
      const sameContext = !!existing
        && existing.author_id === createInput.author_id
        && existing.is_notice === createInput.is_notice
        && !existing.deleted_at;
      const exactReplay = sameContext
        && existing.title === createInput.title
        && existing.content === createInput.content
        && existing.category === createInput.category
        && existing.region === createInput.region;
      if (exactReplay) {
        return NextResponse.json({ post: { id: postId }, replayed: true });
      }
      if (sameContext) {
        return NextResponse.json({
          error: '같은 생성 ID로 이미 다른 내용의 게시글이 등록되었습니다. 기존에 생성된 게시글을 확인한 뒤 해당 항목을 수정해주세요.',
        }, { status: 409 });
      }
      if (existing && existing.author_id === createInput.author_id && existing.is_notice === false) {
        return NextResponse.json({ error: '이미 삭제된 생성 요청입니다. 새 작성 화면에서 다시 등록해주세요.' }, { status: 409 });
      }
      return NextResponse.json({ error: '이미 사용된 생성 ID입니다.' }, { status: 409 });
    }
    console.error('[posts/create] failed:', error);
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : `등록에 실패했습니다: ${error.message}` },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  return NextResponse.json({ post: { id: postId } });
}
