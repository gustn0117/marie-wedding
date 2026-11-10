import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveExternalOrigin } from '@/lib/proxy';
import { completeSocialLogin, sanitizeReturnTo } from '@/lib/auth/completeSocialLogin';

export const runtime = 'nodejs';

/**
 * Supabase native OAuth(카카오) callback. 세션을 만든 뒤의 처리(밴 확인·탈퇴 계정 초기화·
 * 신규 프로필 생성·온보딩 분기)는 애플 앱 로그인과 같이 쓰는 completeSocialLogin 에 있다.
 *
 * 동일 이메일 충돌은 Supabase가 자체 처리 (exchangeCodeForSession 에러 → /login?error=conflict).
 */
export async function GET(request: Request) {
  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
  const { searchParams } = new URL(request.url);
  const origin = resolveExternalOrigin(request);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next');
  const next = sanitizeReturnTo(requestedNext) ?? '/jobs';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
        }),
      },
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // 코드 교환 실패. 두 갈래로 구분:
    //  (1) 계정 연결(linkIdentity) 실패 — 이미 다른 계정에 사용 중인 소셜을 연결 시도.
    //      이 경우 사용자의 기존 세션은 살아있으므로 로그인 페이지로 보내면 미들웨어가
    //      다시 홈으로 튕겨 '조용히 메인 이동'처럼 보인다. → 온 곳(next)으로 되돌리고 명시적 에러.
    //  (2) 신규 로그인 실패(동일 이메일 타 provider 충돌 등) — 세션 없음 → 로그인 페이지로.
    const { data: { user: existing } } = await supabase.auth.getUser();
    if (existing) {
      const backTo = next && next.startsWith('/') ? next : '/mypage/edit';
      const sep = backTo.includes('?') ? '&' : '?';
      return NextResponse.redirect(`${origin}${backTo}${sep}social_error=link_conflict`);
    }
    // 동일 이메일이 이미 다른 provider로 등록된 경우 등 — provider 노출 없이 generic
    return NextResponse.redirect(`${origin}/login?error=conflict`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const serviceClient = createServiceClient(deadline);
  const outcome = await completeSocialLogin({
    user,
    cookieStore,
    serviceClient,
    next,
    logTag: 'auth/callback',
  });
  if (!outcome.ok) {
    return NextResponse.redirect(`${origin}/login?error=${outcome.error}`);
  }
  return NextResponse.redirect(`${origin}${outcome.path}`);
}
