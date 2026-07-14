import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveExternalOrigin } from '@/lib/proxy';

export const runtime = 'nodejs';

/**
 * Supabase native OAuth (Kakao/Google/Apple) callback.
 *
 * 신규 사용자: profile row를 onboarded_at=null 상태로 생성하고 /onboarding으로 강제.
 * 기존 사용자: onboarded_at 여부에 따라 /onboarding 또는 next 경로로.
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

  // Header(SSR)가 redirect 직후 첫 페이지에서 즉시 사용자를 인지하도록
  // marie_profile cookie를 redirect 응답에 함께 set한다.
  // (이전: 미들웨어 의존 → race로 첫 SSR에 cookie 미적용 → '로그인' 버튼이 잠시 노출)
  const setProfileCookieFromUserId = async (userId: string) => {
    const { data: p } = await serviceClient
      .from('profiles')
      .select('id, contact_name, company_name, account_type, role, region, profile_image, is_directory_listed')
      .eq('user_id', userId)
      .maybeSingle();
    if (!p) return;
    cookieStore.set('marie_profile', JSON.stringify(p), {
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
  };

  const { data: existingProfile } = await serviceClient
    .from('profiles')
    .select('id, onboarded_at, deleted_at')
    .eq('user_id', user.id)
    .maybeSingle();

  // 탈퇴한 프로필로 재로그인 시도 → 완전 초기화 후 새로 온보딩.
  // reactivate_profile_clean RPC 가 bio/phone/gallery/verification_* 등 모든
  // 사용자 컬럼을 NULL/default 로 리셋. (jobs/posts/comments 등 소유 콘텐츠는
  // 이미 purge cascade 로 soft-delete 된 상태 — 복구하지 않음.)
  if (existingProfile?.deleted_at) {
    const { error: rpcErr } = await serviceClient.rpc('reactivate_profile_clean', {
      p_profile_id: existingProfile.id,
    });
    if (rpcErr) {
      console.error('[auth/callback] reactivate_profile_clean failed:', rpcErr);
      // fallback: 최소 3개 컬럼만 리셋 (레거시 동작)
      await serviceClient
        .from('profiles')
        .update({ deleted_at: null, onboarded_at: null, is_directory_listed: false })
        .eq('id', existingProfile.id);
    }
    await setProfileCookieFromUserId(user.id);
    return NextResponse.redirect(
      `${origin}/onboarding?next=${encodeURIComponent(next)}`
    );
  }

  if (!existingProfile) {
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username ||
      user.email?.split('@')[0] ||
      '사용자';

    const provider =
      (user.app_metadata?.provider as string | undefined) ||
      user.identities?.[0]?.provider ||
      'email';

    // /signup STEP 0에서 선택한 유형이 cookie로 전달됐으면 preset
    const presetRaw = cookieStore.get('signup_account_type')?.value;
    const presetAccountType =
      presetRaw === 'business' || presetRaw === 'individual' ? presetRaw : null;
    if (presetRaw) {
      // 1회용 cookie 즉시 삭제
      cookieStore.set('signup_account_type', '', { path: '/', maxAge: 0 });
    }

    await serviceClient.from('profiles').insert({
      user_id: user.id,
      contact_name: name,
      account_type: presetAccountType,
      region: null,
      signup_provider: provider,
      onboarded_at: null,
    });

    await setProfileCookieFromUserId(user.id);
    return NextResponse.redirect(
      `${origin}/onboarding?next=${encodeURIComponent(next)}`
    );
  }

  await setProfileCookieFromUserId(user.id);

  if (!existingProfile.onboarded_at) {
    return NextResponse.redirect(
      `${origin}/onboarding?next=${encodeURIComponent(next)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}
