import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_SCHEMA } from './schema';
import { resolveExternalOrigin } from '@/lib/proxy';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME, secure: process.env.NODE_ENV === 'production' },
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

  const path = request.nextUrl.pathname;

  // /api·/auth 는 라우트 핸들러/OAuth 콜백이 자체적으로 세션을 검증하므로
  // 미들웨어의 getUser(GoTrue 네트워크)·프로필 동기화(DB)가 불필요하다.
  // 조기 통과해 고빈도 API/저장 요청의 서버 부하를 제거한다. (1,000 동시접속 대비)
  if (path.startsWith('/api/') || path.startsWith('/auth/')) {
    return supabaseResponse;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

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

    // Sync profile cookie — 매 요청 프로필을 fresh 하게 조회한다.
    // (이전 hardening22 의 mp_fresh 30초 스로틀은 onboarded_at/banned_at 등을 캐시해
    //  온보딩 완료·로그인·로그아웃 직후 미들웨어(캐시)와 페이지(fresh) 판단이 어긋나
    //  /onboarding↔/jobs 리다이렉트 루프를 유발 → 제거. 프로필 조회는 인덱스로 가벼움.)
    if (user) {
      {
        const serviceClient = createClient(
          SUPABASE_SERVER_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { db: { schema: SUPABASE_SCHEMA } }
        );
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('id,contact_name,company_name,account_type,role,region,profile_image,is_directory_listed,banned_at,banned_reason,onboarded_at,signup_provider,deleted_at')
          .eq('user_id', user.id)
          .single();

        // 탈퇴 프로필인데 세션이 살아있음 = 방금 재로그인(탈퇴 시 로그아웃되므로 이 상태는
        // 재로그인으로만 도달). /auth/reactivate 로 보내 소셜과 동일하게 재활성화한다.
        // 관리자 삭제 계정은 GoTrue ban 되어 재로그인 자체가 막히고, 혹 세션이 남아도
        // /auth/reactivate 가 ban 을 재확인해 거부한다 → 자가탈퇴만 부활.
        // (세션 쿠키는 유지해야 그 라우트가 사용자를 식별하므로 clear 하지 않는다.)
        if (profile?.deleted_at) {
          const url = request.nextUrl.clone();
          url.pathname = '/auth/reactivate';
          url.search = '';
          url.searchParams.set('next', isAuthPage ? '/jobs' : path);
          return NextResponse.redirect(url);
        }

        // 로그인한 정상 사용자가 로그인/회원가입 페이지 접근 시 홈으로 리다이렉트
        if (isAuthPage) {
          const url = request.nextUrl.clone();
          url.pathname = '/';
          return NextResponse.redirect(url);
        }

        // 제재된 사용자 — /banned + /auth + /api + /admin(관리자 자체 게이트) 외 모든 페이지 차단.
        // /api 는 여기서 리다이렉트하지 않는다(리다이렉트 응답은 fetch/API 클라이언트에 부적절).
        // 대신 각 write API 라우트(posts/create·update, jobs/write, portfolios/write,
        // events/write, directory/update, verifications/submit)가 프로필의 banned_at 을
        // 직접 검사해 403 을 반환한다 — service_role 우회 write 경로의 제재 무력화를 라우트 레벨에서 봉인.
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
      // 비로그인 사용자가 인증 필요 경로에 접근 시 → /login?redirect={path+search} 로 통일
      // (기존: 개별 페이지에서 redirect(ROUTES.LOGIN) 만 호출해 원경로 유실)
      const needsAuth =
        !isPublicBypass &&
        // 커뮤니티는 목록·글 상세(/community/[id])까지 공개해 검색 색인 가능하게 하고,
        // 작성/수정(/community/new, /community/[id]/edit)만 로그인 필수로 남긴다.
        (path.startsWith('/mypage')
          || path.startsWith('/applications')
          || path.startsWith('/jobs/new')
          || path.startsWith('/community/new')
          || (path.startsWith('/community/') && path.endsWith('/edit')));
      if (needsAuth) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        const backto = path + (request.nextUrl.search || '');
        url.searchParams.set('redirect', backto);
        url.search = url.searchParams.toString();
        return NextResponse.redirect(url);
      }
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
