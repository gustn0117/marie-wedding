import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_SCHEMA } from './schema';
import { resolveExternalOrigin } from '@/lib/proxy';

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
          .select('id,contact_name,company_name,account_type,role,region,profile_image,is_directory_listed,banned_at,banned_reason,onboarded_at,signup_provider,deleted_at')
          .eq('user_id', user.id)
          .single();

        // 탈퇴된 프로필로 로그인된 세션 — 모든 인증 쿠키 만료시키고 로그인으로 redirect
        // (auth.user 는 남고 profile.deleted_at 만 set 된 케이스: 탈퇴 후 동일 세션 재사용 시도)
        if (profile?.deleted_at) {
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          url.search = '';
          const res = NextResponse.redirect(url);
          const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
          res.cookies.set('marie_profile', '', expire);
          for (const c of request.cookies.getAll()) {
            if (c.name.startsWith('sb-')) {
              res.cookies.set(c.name, '', { ...expire, httpOnly: true });
            }
          }
          return res;
        }

        // 제재된 사용자 — /banned + /auth + /api + /admin(관리자 자체 게이트) 외 모든 페이지 차단
        if (profile?.banned_at
            && !request.nextUrl.pathname.startsWith('/banned')
            && !request.nextUrl.pathname.startsWith('/auth/callback')
            && !request.nextUrl.pathname.startsWith('/api')
            && !request.nextUrl.pathname.startsWith('/admin')) {
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
          // next 에 pathname + search 모두 보존 — 필터/쿼리 상태를 온보딩 후 그대로 복원
          const fullNext = path + (request.nextUrl.search || '');
          url.searchParams.set('next', fullNext);
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
  } catch (err) {
    // fail-closed: Supabase 연결/스키마 오류 시 로그인 페이지 접근·정적 자산 외에는 /login 으로 튕김.
    // (이전: 모두 통과시켜 탈퇴/제재 계정이 진입 가능했음)
    console.error('[middleware] auth guard failed:', err);
    const path = request.nextUrl.pathname;
    const isFailSafe =
      path === '/' ||
      path.startsWith('/login') ||
      path.startsWith('/signup') ||
      path.startsWith('/auth/') ||
      path.startsWith('/api/') ||
      path.startsWith('/_next/') ||
      path.startsWith('/favicon') ||
      path.startsWith('/banned') ||
      path.startsWith('/admin'); // admin 은 자체 게이트
    if (!isFailSafe) {
      const externalOrigin = resolveExternalOrigin(request);
      const loginUrl = new URL(`${externalOrigin}/login`);
      const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set('marie_profile', '', expire);
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-')) {
          res.cookies.set(c.name, '', { ...expire, httpOnly: true });
        }
      }
      return res;
    }
  }

  return supabaseResponse;
}
