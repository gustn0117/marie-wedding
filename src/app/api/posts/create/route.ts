import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 게시글 등록 API (service_role).
 *
 * 배경: 클라이언트에서 .insert().select().maybeSingle() 시 RLS readback 또는
 *      moderation trigger 영향으로 data=null 이 반환되어 UI가 '실패' 로 인식하지만
 *      실제 DB엔 row 가 저장되는 케이스가 있어 QA-010 으로 보고됨.
 *
 * 대응: service_role 로 INSERT + RETURNING. 인증된 사용자만 본인 명의로 작성 가능.
 */
export async function POST(request: Request) {
  let body: { title?: string; content?: string; category?: string; region?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  const content = (body.content ?? '').trim();
  const category = (body.category ?? '').trim();
  const region = body.region?.trim() || null;

  if (!title || !content || !category) {
    return NextResponse.json({ error: '제목·내용·카테고리는 필수입니다.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  const { data: { user } } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, onboarded_at, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

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

  const { data: post, error } = await service
    .from('posts')
    .insert({
      title,
      content,
      category,
      region,
      author_id: profile.id,
    })
    .select('*')
    .single();

  if (error || !post) {
    return NextResponse.json(
      { error: error?.message ?? '게시글 저장 후 다시 읽지 못했습니다.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ post });
}
