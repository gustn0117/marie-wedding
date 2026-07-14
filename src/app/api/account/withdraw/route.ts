import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { removeVerificationDocument } from '@/lib/verification-document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 12_000;

/**
 * 회원 탈퇴 API — service_role 로 한 번에 처리.
 *
 * 기존 흐름: client RPC → await signOut → 쿠키 clear → toast → redirect (3~6s)
 * 신규 흐름: 1) auth 검증, 2) cancel_my_account RPC, 3) Set-Cookie로 모든 인증 쿠키 만료
 *           → 클라는 한 번의 fetch + 즉시 location.href
 */
export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
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
        setAll() { /* no-op — 응답에서 직접 set */ },
      },
    },
  );

  const { data: { user }, error: authError } = await ssr.auth.getUser();
  if (authError && requestSignal.aborted) {
    return NextResponse.json(
      { error: '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' },
      { status: 504 },
    );
  }
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient(requestSignal);

  // 본인 프로필 조회 — deleted_at 무관하게 user_id 기준
  // (네이버 가입 중 profile insert 실패해 orphan 인 케이스 / 이미 삭제 후 재시도 케이스 모두 대응)
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, deleted_at, verification_document')
    .eq('user_id', user.id)
    .abortSignal(requestSignal)
    .maybeSingle();

  if (profileError) {
    console.error('[withdraw] profile lookup failed:', profileError);
    return NextResponse.json(
      { error: requestSignal.aborted ? '탈퇴 처리 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  // 프로필이 아예 없으면 → orphan auth user 만 남음. 그냥 쿠키 정리만 하고 성공 처리.
  if (!profile) {
    const res = NextResponse.json({ success: true, note: 'no_profile' });
    const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
    res.cookies.set('marie_profile', '', expire);
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith('sb-')) {
        res.cookies.set(c.name, '', { ...expire, httpOnly: true });
      }
    }
    return res;
  }

  // 이미 탈퇴된 프로필 → 쿠키만 정리 (재시도 케이스)
  if (profile.deleted_at) {
    const res = NextResponse.json({ success: true, note: 'already_withdrawn' });
    const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
    res.cookies.set('marie_profile', '', expire);
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith('sb-')) {
        res.cookies.set(c.name, '', { ...expire, httpOnly: true });
      }
    }
    return res;
  }

  // purge_profile_cascade RPC — profiles + jobs + posts + comments + applications + reviews + portfolios + notifications
  // 모두 한 트랜잭션에서 idempotent 하게 soft delete. admin softDeleteUser 와 동일 로직.
  const { error: rpcErr } = await service
    .rpc('purge_profile_cascade', { p_profile_id: profile.id })
    .abortSignal(requestSignal);
  if (rpcErr) {
    console.error('[withdraw] purge_profile_cascade failed:', rpcErr);
    return NextResponse.json(
      { error: requestSignal.aborted ? '탈퇴 처리 시간이 초과되었습니다. 현재 계정 상태를 다시 확인해주세요.' : `탈퇴 처리에 실패했습니다: ${rpcErr.message}` },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  // DB purge가 확정된 다음에만 비공개 사업자 서류를 제거한다.
  await removeVerificationDocument(profile.verification_document);

  // 응답에 모든 인증 쿠키 만료 — 클라는 redirect 직후 비로그인 상태
  const res = NextResponse.json({ success: true });
  const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
  res.cookies.set('marie_profile', '', expire);
  // supabase 자체 쿠키 (sb-...) 모두 만료
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-')) {
      res.cookies.set(c.name, '', { ...expire, httpOnly: true });
    }
  }
  return res;
}
