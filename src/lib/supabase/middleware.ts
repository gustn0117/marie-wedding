import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_SCHEMA } from './schema';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')
  ) {
    return supabaseResponse;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isAuthPage = path.startsWith('/login') || path.startsWith('/signup');
    const isAdminPath = path.startsWith('/admin');
    const isOnboardingPath = path === '/onboarding' || path.startsWith('/onboarding/');
    // Public/bypass paths — never trigger onboarding redirect from these
    // /admin/* 은 자체 비밀번호 게이트(layout.tsx)가 처리하므로 미들웨어 통과
    const isPublicBypass =
      path === '/' ||
      path.startsWith('/auth/') ||
      path.startsWith('/api/') ||
      path.startsWith('/login') ||
      path.startsWith('/signup') ||
      path.startsWith('/banned') ||
      path.startsWith('/admin') ||
      isOnboardingPath;

    // 로그인한 사용자가 로그인/회원가입 페이지 접근 시 홈으로 리다이렉트
    if (user && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // Sync profile cookie - always refresh
    if (user) {
      {
        const serviceClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { db: { schema: SUPABASE_SCHEMA } }
        );
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('id,contact_name,company_name,account_type,role,region,profile_image,is_directory_listed,banned_at,banned_reason,onboarded_at,signup_provider')
          .eq('user_id', user.id)
          .single();

        // 제재된 사용자 — /banned 외 모든 페이지 접근 차단
        if (profile?.banned_at && !request.nextUrl.pathname.startsWith('/banned') && !request.nextUrl.pathname.startsWith('/auth/callback') && !request.nextUrl.pathname.startsWith('/api')) {
          const url = request.nextUrl.clone();
          url.pathname = '/banned';
          return NextResponse.redirect(url);
        }

        // /admin/* 는 자체 비밀번호 게이트(admin/layout.tsx)에서 처리 — 미들웨어 차단 제거
        // 로그인 여부와 무관하게 비밀번호만으로 진입 가능 (memory: project_security_exposed_key.md ADMIN_PASSWORD)
        void isAdminPath;

        // Onboarding 가드 — 로그인 + profile 존재하나 onboarded_at IS NULL인 경우 /onboarding으로 강제
        // public/bypass 경로는 통과. 무한 루프 방지: /onboarding 자체는 isPublicBypass에 포함됨.
        if (profile && !profile.onboarded_at && !isPublicBypass) {
          const url = request.nextUrl.clone();
          url.pathname = '/onboarding';
          url.searchParams.set('next', path);
          return NextResponse.redirect(url);
        }

        if (profile) {
          const cookieValue = JSON.stringify(profile);
          // Set on request for downstream server components
          request.cookies.set('marie_profile', cookieValue);
          // Rebuild response with updated request (preserves forwarded cookies)
          const oldCookies = supabaseResponse.cookies.getAll();
          supabaseResponse = NextResponse.next({ request });
          // Re-apply all previously set response cookies (Supabase auth cookies)
          oldCookies.forEach(c => supabaseResponse.cookies.set(c));
          // Set profile cookie on response for browser
          supabaseResponse.cookies.set('marie_profile', cookieValue, {
            path: '/',
            httpOnly: false,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
          });
        }
      }
    } else {
      if (request.cookies.has('marie_profile')) {
        request.cookies.delete('marie_profile');
        supabaseResponse.cookies.delete('marie_profile');
      }
    }
  } catch {
    // Supabase connection failed, allow request through
  }

  return supabaseResponse;
}
