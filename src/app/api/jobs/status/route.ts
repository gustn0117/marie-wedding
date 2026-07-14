import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID = ['open', 'closed', 'filled', 'hidden'] as const;
type JobStatus = (typeof VALID)[number];

/**
 * 공고 상태 변경 (service_role) — 채용 완료/마감/숨김 등.
 * 클라이언트 .update().select().single() 이 RLS 리드백·트리거로 hang 하던 문제 우회.
 * SSR 세션으로 사용자 확인 → 본인 공고(또는 admin)만 허용 → service_role 로 갱신.
 * Body: { id, status }
 */
export async function POST(request: Request) {
  let body: { id?: string; status?: JobStatus };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const { id, status } = body;
  if (!id || !status || !VALID.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient();
  const { data: me } = await service
    .from('profiles')
    .select('id, role, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

  const { data: job } = await service
    .from('jobs')
    .select('id, author_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
  if (job.author_id !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: '본인 공고만 변경할 수 있습니다.' }, { status: 403 });
  }

  const { data, error } = await service
    .from('jobs')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: `상태 변경 실패: ${error.message}` }, { status: 500 });

  return NextResponse.json({ data });
}
