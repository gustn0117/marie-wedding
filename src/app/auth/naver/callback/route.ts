import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import {
  exchangeCodeForToken,
  fetchUserInfo,
  NAVER_STATE_COOKIE,
  NAVER_STATE_COOKIE_PATH,
  placeholderEmailFor,
  verifyState,
} from '@/lib/naver-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 네이버 OAuth 콜백.
 *
 * 흐름:
 * 1. cookie의 rawState ↔ query의 signedState 검증 → cookie 즉시 삭제
 * 2. code → access_token 교환
 * 3. /v1/nid/me → naver_id (필수) + email (옵션)
 * 4. profiles.naver_sub로 기존 user 조회
 *    - 있음: 그 user로 세션 발행
 *    - 없음: email 충돌 검사 후 admin.createUser + profiles INSERT → 세션 발행
 * 5. 세션 발행: admin.generateLink('magiclink') → @supabase/ssr의 verifyOtp로 cookie 자동 세팅
 * 6. onboarded_at 여부에 따라 /onboarding 또는 next로 redirect
 *
 * 에러는 항상 generic 메시지로 /login?error=...로 보내 enumeration 방지.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // callback이 동작한 도메인 그대로 사용 — start와 일치 + 쿠키 도메인 일치 보장
  const origin = new URL(request.url).origin;
  const code = searchParams.get('code');
  const signedState = searchParams.get('state');
  const naverError = searchParams.get('error');

  if (naverError) {
    // 사용자가 동의 거부 등
    return redirectWith(origin, '/login', 'naver_denied');
  }

  if (!code || !signedState) {
    return redirectWith(origin, '/login', 'naver_invalid_request');
  }

  // ① state 검증 (1회용)
  const cookieStore = await cookies();
  const rawState = cookieStore.get(NAVER_STATE_COOKIE)?.value;
  const nextCookie = cookieStore.get('naver_oauth_next')?.value;

  // 즉시 삭제 — 검증 결과 무관하게 재사용 차단
  cookieStore.set(NAVER_STATE_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: NAVER_STATE_COOKIE_PATH,
    maxAge: 0,
  });
  cookieStore.set('naver_oauth_next', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: NAVER_STATE_COOKIE_PATH,
    maxAge: 0,
  });

  if (!verifyState(rawState, signedState)) {
    return redirectWith(origin, '/login', 'naver_state_mismatch');
  }

  const next = sanitizeReturnTo(nextCookie) ?? '/jobs';

  // ② code → access_token
  let accessToken: string;
  try {
    const tokenResp = await exchangeCodeForToken(origin, code, signedState);
    accessToken = tokenResp.access_token;
  } catch {
    return redirectWith(origin, '/login', 'naver_token_failed');
  }

  // ③ /v1/nid/me
  let userInfo;
  try {
    userInfo = await fetchUserInfo(accessToken);
  } catch {
    return redirectWith(origin, '/login', 'naver_profile_failed');
  }

  const naverSub = userInfo.id;
  if (!naverSub) {
    return redirectWith(origin, '/login', 'naver_no_id');
  }

  const service = createServiceClient();

  // /signup STEP 0에서 cookie로 전달된 계정 유형 preset
  const presetRaw = cookieStore.get('signup_account_type')?.value;
  const presetAccountType: 'individual' | 'business' | null =
    presetRaw === 'business' || presetRaw === 'individual' ? presetRaw : null;
  if (presetRaw) {
    cookieStore.set('signup_account_type', '', { path: '/', maxAge: 0 });
  }

  // ④ 기존 user 조회 (naver_sub 기준)
  const { data: existingByNaver } = await service
    .from('profiles')
    .select('id, user_id, onboarded_at')
    .eq('naver_sub', naverSub)
    .maybeSingle();

  let targetUserEmail: string;
  let isNewUser = false;

  if (existingByNaver?.user_id) {
    // 기존 네이버 user — 그 user의 이메일을 가져와야 함
    const { data: authUser } = await service.auth.admin.getUserById(existingByNaver.user_id);
    targetUserEmail = authUser?.user?.email ?? placeholderEmailFor(naverSub);
  } else {
    // 신규 가입
    const realEmail = userInfo.email?.trim().toLowerCase();
    if (realEmail) {
      // email로 기존 user 있는지 검사 (네이버가 아닌 다른 provider로 가입)
      const { data: existingByEmail } = await service
        .from('profiles')
        .select('id, signup_provider')
        .eq('contact_name', userInfo.name ?? '') // contact_name으론 충돌 못 막음 — 아래에서 admin API로 검증
        .maybeSingle();
      void existingByEmail; // unused, kept for future enumeration prevention layer

      // Supabase admin API로 동일 email user 직접 조회
      const { data: usersList } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const conflict = usersList?.users?.find(
        (u) => u.email?.toLowerCase() === realEmail,
      );
      if (conflict) {
        // 다른 provider로 가입된 이메일 — generic 메시지로 차단
        return redirectWith(origin, '/login', 'conflict');
      }

      const created = await service.auth.admin.createUser({
        email: realEmail,
        email_confirm: false, // 네이버 email은 검증 미보장 — 추후 OTP로 검증
        user_metadata: { provider: 'naver', naver_id: naverSub, name: userInfo.name },
      });
      if (created.error || !created.data.user) {
        return redirectWith(origin, '/login', 'naver_create_failed');
      }
      targetUserEmail = realEmail;
      await service.from('profiles').insert({
        user_id: created.data.user.id,
        contact_name: userInfo.name ?? '사용자',
        account_type: presetAccountType,
        region: null,
        signup_provider: 'naver',
        naver_sub: naverSub,
        onboarded_at: null,
      });
      isNewUser = true;
    } else {
      // 이메일 미제공 — placeholder로 생성, 추후 /onboarding/email-required에서 교체
      const placeholder = placeholderEmailFor(naverSub);
      const created = await service.auth.admin.createUser({
        email: placeholder,
        email_confirm: false,
        user_metadata: { provider: 'naver', naver_id: naverSub, name: userInfo.name, needs_email: true },
      });
      if (created.error || !created.data.user) {
        return redirectWith(origin, '/login', 'naver_create_failed');
      }
      targetUserEmail = placeholder;
      await service.from('profiles').insert({
        user_id: created.data.user.id,
        contact_name: userInfo.name ?? '사용자',
        account_type: presetAccountType,
        region: null,
        signup_provider: 'naver',
        naver_sub: naverSub,
        onboarded_at: null,
      });
      isNewUser = true;
    }
  }

  // ⑤ 세션 발행: generateLink로 token_hash 받아서 verifyOtp로 쿠키 자동 세팅
  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUserEmail,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return redirectWith(origin, '/login', 'naver_session_failed');
  }

  // @supabase/ssr의 createServerClient(cookies()) 인스턴스에서 verifyOtp 호출
  // → SDK가 자동으로 Set-Cookie를 발행해 브라우저 세션 쿠키를 심는다.
  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  const { error: verifyErr } = await ssrClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr) {
    return redirectWith(origin, '/login', 'naver_session_failed');
  }

  // Header(SSR) 즉시 갱신을 위해 marie_profile cookie 동봉
  try {
    const { data: { user: justSignedIn } } = await ssrClient.auth.getUser();
    if (justSignedIn?.id) {
      const { data: p } = await service
        .from('profiles')
        .select('id, contact_name, company_name, account_type, role, region, profile_image, is_directory_listed')
        .eq('user_id', justSignedIn.id)
        .maybeSingle();
      if (p) {
        cookieStore.set('marie_profile', JSON.stringify(p), {
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
        });
      }
    }
  } catch {
    // cookie 못 set해도 미들웨어가 다음 요청에 set — 사용자 영향 최소
  }

  // ⑥ redirect
  const onboarded = existingByNaver?.onboarded_at;
  if (isNewUser || !userInfo.email) {
    return NextResponse.redirect(
      `${origin}/onboarding${userInfo.email ? '' : '/email-required'}?next=${encodeURIComponent(next)}`,
    );
  }
  if (!onboarded) {
    return NextResponse.redirect(`${origin}/onboarding?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

function redirectWith(origin: string, path: string, code: string) {
  return NextResponse.redirect(`${origin}${path}?error=${encodeURIComponent(code)}`);
}

function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}
