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
 * 지원/문의 접수 (service_role) — 클라이언트 .insert().select().single() 이
 * RLS/트리거로 hang 하던 문제 우회. 지원자는 SSR 세션에서 서버가 직접 판별.
 * Body: { jobId, message, contactPhone? }
 */
export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  let body: { jobId?: string; message?: string; contactPhone?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const jobId = body.jobId;
  const message = (body.message ?? '').trim();
  const contactPhone = body.contactPhone?.trim() || null;
  if (!jobId || message.length < 10) {
    return NextResponse.json({ error: '지원 내용을 10자 이상 입력해주세요.' }, { status: 400 });
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
      { error: requestSignal.aborted ? '접수 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

  const { data, error } = await service
    .from('applications')
    .insert({ job_id: jobId, applicant_id: me.id, message, contact_phone: contactPhone })
    // service_role 응답에서 profiles(*)를 직렬화하면 admin_note·인증서 경로 등
    // 내부 컬럼까지 브라우저에 노출된다. 작성 직후 UI에 필요한 지원서 필드만 반환한다.
    .select('id, job_id, applicant_id, message, contact_phone, status, author_note, created_at, updated_at, deleted_at, hiring_completed_at, applicant_completed_at, first_responded_at')
    .abortSignal(requestSignal)
    .single();
  if (error) {
    const dup = error.message.includes('duplicate') || error.code === '23505';
    const timedOut = requestSignal.aborted;
    return NextResponse.json(
      { error: timedOut ? '접수 처리 시간이 초과되었습니다. 접수 내역을 확인한 뒤 다시 시도해주세요.' : dup ? '이미 접수된 내역이 있습니다.' : error.message },
      { status: timedOut ? 504 : dup ? 409 : 500 },
    );
  }
  return NextResponse.json({ data });
}
