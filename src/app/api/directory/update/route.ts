import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const { data: { user } } = await ssr.auth.getUser();
  const tAuth = Date.now();
  if (!user) {
    console.warn('[api/directory/update] 401 no session', { profile_id: id, elapsed_ms: tAuth - t0 });
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient();
  const [{ data: target }, { data: me }] = await Promise.all([
    service.from('profiles').select('id, user_id, role').eq('id', id).is('deleted_at', null).maybeSingle(),
    service.from('profiles').select('id, role, banned_at').eq('user_id', user.id).is('deleted_at', null).maybeSingle(),
  ]);
  const tLookup = Date.now();

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

  // 1) UPDATE — .select() 없이. RETURNING 직렬화로 인해 trigger/RLS 이슈 발생 가능
  const { error: updateErr } = await service
    .from('profiles')
    .update(payload)
    .eq('id', id);
  const tUpdate = Date.now();

  if (updateErr) {
    console.error('[api/directory/update] UPDATE failed', { profile_id: id, elapsed_ms: tUpdate - t0, err: updateErr });
    return NextResponse.json(
      { error: `저장에 실패했습니다: ${updateErr.message}` },
      { status: 500 },
    );
  }

  // 2) 별도 SELECT — service_role 는 RLS 우회하므로 항상 row 조회 가능
  const { data, error: selectErr } = await service
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const tSelect = Date.now();

  if (selectErr) {
    console.error('[api/directory/update] post-update SELECT failed', { profile_id: id, elapsed_ms: tSelect - t0, err: selectErr });
    return NextResponse.json(
      { error: `저장은 되었지만 다시 읽지 못했습니다: ${selectErr.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    console.error('[api/directory/update] post-update row missing', { profile_id: id, elapsed_ms: tSelect - t0 });
    return NextResponse.json(
      { error: '저장 후 프로필을 찾을 수 없습니다.' },
      { status: 500 },
    );
  }
  const total = tSelect - t0;
  console.info('[api/directory/update] ok', {
    profile_id: id,
    total_ms: total,
    auth_ms: tAuth - t0,
    lookup_ms: tLookup - tAuth,
    update_ms: tUpdate - tLookup,
    select_ms: tSelect - tUpdate,
    fields: Object.keys(payload).length,
  });
  return NextResponse.json({ success: true, data });
}
