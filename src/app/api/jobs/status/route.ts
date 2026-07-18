import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;

const VALID = ['open', 'closed', 'filled', 'hidden'] as const;
type JobStatus = (typeof VALID)[number];

/**
 * 공고 상태 변경 (service_role) — 채용 완료/마감/숨김 등.
 * 클라이언트 .update().select().single() 이 RLS 리드백·트리거로 hang 하던 문제 우회.
 * SSR 세션으로 사용자 확인 → 본인 공고(또는 admin)만 허용 → service_role 로 갱신.
 * Body: { id, status }
 */
export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
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

  const service = createServiceClient(requestSignal);
  const { data: me, error: profileError } = await service
    .from('profiles')
    .select('id, role, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .abortSignal(requestSignal)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: requestSignal.aborted ? '상태 변경 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

  const { data: job, error: jobError } = await service
    .from('jobs')
    .select('id, author_id, deadline')
    .eq('id', id)
    .is('deleted_at', null)
    .abortSignal(requestSignal)
    .maybeSingle();
  if (jobError) {
    return NextResponse.json(
      { error: requestSignal.aborted ? '상태 변경 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '공고 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!job) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
  if (job.author_id !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: '본인 공고만 변경할 수 있습니다.' }, { status: 403 });
  }

  // '다시 모집'(open) 인데 기한이 이미 지났으면 status 만 바꿔선 목록·상세가 계속 마감으로
  // 보이고 30분 자동마감 cron 이 곧바로 closed 로 되돌린다. 기한을 비워(상시 모집) 실제로
  // 재개되게 한다. 사장은 이후 공고 수정에서 새 마감일을 설정할 수 있다.
  const reopeningExpired = status === 'open' && !!job.deadline && new Date(job.deadline).getTime() <= Date.now();
  const updatePayload = reopeningExpired ? { status, deadline: null } : { status };

  const { data, error } = await service
    .from('jobs')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .abortSignal(requestSignal)
    .single();
  if (error) {
    return NextResponse.json(
      { error: requestSignal.aborted ? '상태 변경 시간이 초과되었습니다. 현재 공고 상태를 다시 확인해주세요.' : `상태 변경 실패: ${error.message}` },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  return NextResponse.json({ data });
}
