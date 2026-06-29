import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

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
  const { searchParams } = new URL(request.url);
  // Cloudflare tunnel + Docker 환경에선 request.url 이 컨테이너 내부 바인딩
  // (http://0.0.0.0:3000)을 가리키므로 X-Forwarded-Host 로 외부 도메인 검출.
  const origin = resolveExternalOrigin(request);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next');
  const next = sanitizeReturnTo(requestedNext) ?? '/jobs';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    // 동일 이메일이 이미 다른 provider로 등록된 경우 등 — provider 노출 없이 generic
    return NextResponse.redirect(`${origin}/login?error=conflict`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const serviceClient = createServiceClient();

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
    .select('id, onboarded_at')
    .eq('user_id', user.id)
    .maybeSingle();

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

/**
 * Reverse proxy 뒤에서 사용자가 실제 접속한 외부 origin을 찾는다.
 * 우선순위: X-Forwarded-Host > Host > NEXT_PUBLIC_APP_URL > request.url.origin
 * 0.0.0.0 / localhost / 127.0.0.1 / 사설 IP 는 컨테이너 내부 주소로 간주하고 제외.
 */
function resolveExternalOrigin(request: Request): string {
  const isInternal = (h: string | null) =>
    !h || /^(0\.0\.0\.0|localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i.test(h);

  const xfHost = request.headers.get('x-forwarded-host');
  const xfProto = request.headers.get('x-forwarded-proto');
  if (xfHost && !isInternal(xfHost)) {
    return `${xfProto || 'https'}://${xfHost}`;
  }

  const host = request.headers.get('host');
  if (host && !isInternal(host)) {
    return `${xfProto || 'https'}://${host}`;
  }

  const envOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (envOrigin && !isInternal(new URL(envOrigin).hostname)) {
    return envOrigin.replace(/\/$/, '');
  }

  return new URL(request.url).origin;
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}
