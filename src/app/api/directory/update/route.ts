import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 클라이언트 저장 요청(15초)보다 먼저 실패를 돌려줘 UI가 무한 대기하지 않게 한다.
// 같은 signal을 인증/조회/수정 전체에 사용하므로 단계마다 timeout이 새로 시작되지 않는다.
const WRITE_TIMEOUT_MS = 10_000;

/**
 * 디렉토리/프로필 업데이트 API (service_role).
 *
 * 배경: 클라이언트 .update().select().maybeSingle() 가
 *  - RLS readback / moderation trigger 영향으로 응답 hang
 *  - 또는 data=null 반환 → UI 무한 '저장 중...'
 * 이 문제를 service_role 우회로 해결.
 *
 * 본인 또는 admin 만 허용.
 */
export async function POST(request: Request) {
  const t0 = Date.now();
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(WRITE_TIMEOUT_MS)]);
  let body: { id?: string; updates?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const { id, updates } = body;
  if (!id || !updates) {
    return NextResponse.json({ error: 'id 및 updates 필수입니다.' }, { status: 400 });
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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user }, error: authError } = await ssr.auth.getUser();
  const tAuth = Date.now();
  if (authError && requestSignal.aborted) {
    console.error('[api/directory/update] auth timeout', { profile_id: id, elapsed_ms: tAuth - t0 });
    return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 });
  }
  if (!user) {
    console.warn('[api/directory/update] 401 no session', { profile_id: id, elapsed_ms: tAuth - t0 });
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient(requestSignal);
  const [targetResult, meResult] = await Promise.all([
    service.from('profiles').select('id, user_id, role, phone').eq('id', id).is('deleted_at', null).abortSignal(requestSignal).maybeSingle(),
    service.from('profiles').select('id, role, banned_at').eq('user_id', user.id).is('deleted_at', null).abortSignal(requestSignal).maybeSingle(),
  ]);
  const tLookup = Date.now();
  const { data: target, error: targetError } = targetResult;
  const { data: me, error: meError } = meResult;

  if (targetError || meError) {
    console.error('[api/directory/update] profile lookup failed', {
      profile_id: id,
      elapsed_ms: tLookup - t0,
      target_error: targetError,
      requester_error: meError,
    });
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  if (!target) {
    console.warn('[api/directory/update] 404 target missing', { profile_id: id, elapsed_ms: tLookup - t0 });
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 제재된 요청자는 본인/타인 프로필 수정 불가 (admin 제재자 포함). target 이 아닌 요청자(me) 기준.
  if (me?.banned_at) {
    console.warn('[api/directory/update] 403 banned requester', { profile_id: id, requester: me.id, elapsed_ms: tLookup - t0 });
    return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });
  }

  const isOwner = target.user_id === user.id;
  const isAdmin = me?.role === 'admin';
  if (!isOwner && !isAdmin) {
    console.warn('[api/directory/update] 403 not owner', { profile_id: id, requester: me?.id, elapsed_ms: tLookup - t0 });
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  // 화이트리스트 — UI 가 보내는 필드만 허용
  const ALLOWED = new Set([
    'contact_name', 'company_name', 'business_type', 'region',
    'bio', 'phone', 'website', 'profile_image', 'cover_image',
    'company_size', 'established_year', 'address', 'gallery',
    'is_directory_listed',
  ]);
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(updates)) {
    if (ALLOWED.has(k)) payload[k] = v;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'phone')) {
    if (updates.phone !== null && typeof updates.phone !== 'string') {
      return NextResponse.json({ error: '연락처 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    const nextPhone = typeof updates.phone === 'string' ? updates.phone.trim() || null : null;
    payload.phone = nextPhone;
    if (nextPhone !== (target.phone ?? null)) {
      // 인증된 번호 자체가 바뀌면 배지를 원자적으로 해제한다. phone_verified는
      // 검증된 OTP 경로에서만 다시 true가 된다.
      payload.phone_verified = false;
      payload.phone_verified_at = null;
    }
  }

  // UPDATE — .select() 없이. RETURNING 직렬화로 인해 trigger/RLS 이슈 발생 가능
  const { error: updateErr } = await service
    .from('profiles')
    .update(payload)
    .eq('id', id)
    .abortSignal(requestSignal);
  const tUpdate = Date.now();

  if (updateErr) {
    console.error('[api/directory/update] UPDATE failed', { profile_id: id, elapsed_ms: tUpdate - t0, err: updateErr });
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : `저장에 실패했습니다: ${updateErr.message}` },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  const total = tUpdate - t0;
  console.info('[api/directory/update] ok', {
    profile_id: id,
    total_ms: total,
    auth_ms: tAuth - t0,
    lookup_ms: tLookup - tAuth,
    update_ms: tUpdate - tLookup,
    fields: Object.keys(payload).length,
  });
  // 호출부는 전체 row를 사용하지 않는다. id만 돌려 불필요한 post-update SELECT와
  // 민감한 프로필 컬럼의 과도한 직렬화를 없애되 기존 응답 shape는 유지한다.
  return NextResponse.json({ success: true, data: { id } });
}
