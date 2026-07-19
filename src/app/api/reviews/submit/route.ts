import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { SUPABASE_SCHEMA } from '@/lib/supabase/schema';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 리뷰 제출 — submit_review RPC 는 auth.uid() 로 리뷰어를 판별하므로
 * SSR 세션 클라이언트로 서버(내부 kong)에서 호출. 클라이언트가 Cloudflare 경유로
 * rpc 직접 호출 시 세션토큰 지연으로 hang 하던 문제 우회.
 * Body: { applicationId, tagIds: string[] }
 */
export async function POST(request: Request) {
  let body: { applicationId?: string; tagIds?: string[] };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const { applicationId, tagIds } = body;
  if (!applicationId || !Array.isArray(tagIds)) {
    return NextResponse.json({ error: '리뷰 정보를 확인해주세요.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(SUPABASE_SERVER_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    // schema 누락 시 submit_review 를 public 스키마로 호출해 PGRST202(함수 없음) → 리뷰가
    // 100% 저장 안 됐다. marie_wedding 스키마를 명시한다.
    db: { schema: SUPABASE_SCHEMA },
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
    },
  });
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // 제재(banned) 유저는 리뷰 제출 차단 (상대 평판 조작 방지).
  const { data: me } = await ssr.from('profiles').select('banned_at').eq('user_id', user.id).maybeSingle();
  if (me?.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

  const { data, error } = await ssr.rpc('submit_review', {
    p_application_id: applicationId,
    p_tag_ids: tagIds,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
