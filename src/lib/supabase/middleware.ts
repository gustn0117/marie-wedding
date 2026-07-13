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
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
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

    // Sync profile cookie
    if (user) {
      {
        // 프로필 DB 조회 스로틀 — 1,000 동시접속 대비 PostgREST/PG 부하 절감.
        // 최근 30초 내 동기화(mp_fresh 마커)됐고 marie_profile 쿠키가 있으면 DB 조회·쿠키
        // 재설정 없이 쿠키의 프로필로 게이팅한다. getUser(세션 검증)는 위에서 매 요청 수행하므로
        // 세션 무효화는 즉시 반영되고, 역할/제재/온보딩/탈퇴 변경은 최대 30초 내 반영된다.
        const syncFresh = request.cookies.get('mp_fresh')?.value === '1';
        const rawProfile = request.cookies.get('marie_profile')?.value;
        let profile: {
          id?: string; deleted_at?: string | null; banned_at?: string | null;
          onboarded_at?: string | null; [k: string]: unknown;
        } | null = null;
        let fromCache = false;
        if (syncFresh && rawProfile) {
          try { profile = JSON.parse(rawProfile); fromCache = true; } catch { profile = null; }
        }
        if (!profile) {
          const serviceClient = createClient(
            SUPABASE_SERVER_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { db: { schema: SUPABASE_SCHEMA } }
          );
          const { data } = await serviceClient
            .from('profiles')
            .select('id,contact_name,company_name,account_type,role,region,profile_image,is_directory_listed,banned_at,banned_reason,onboarded_at,signup_provider,deleted_at')
            .eq('user_id', user.id)
            .single();
          profile = data;
        }

        // 탈퇴된 프로필 검사 우선 — isAuthPage / '/' 무한 루프 방지.
        // /login 자체는 그대로 표시 (redirect 하면 세션이 여전히 살아있어 다시 여기로 옴).
        if (profile?.deleted_at) {
          const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
          if (isAuthPage) {
            // 로그인 페이지에 이미 있음 — 쿠키만 clear
            supabaseResponse.cookies.set('marie_profile', '', expire);
            for (const c of request.cookies.getAll()) {
              if (c.name.startsWith('sb-')) {
                supabaseResponse.cookies.set(c.name, '', { ...expire, httpOnly: true });
              }
            }
            return supabaseResponse;
          }
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          url.search = '';
          const res = NextResponse.redirect(url);
          res.cookies.set('marie_profile', '', expire);
          for (const c of request.cookies.getAll()) {
            if (c.name.startsWith('sb-')) {
              res.cookies.set(c.name, '', { ...expire, httpOnly: true });
            }
          }
          return res;
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

        // 방금 DB 에서 새로 조회한 경우에만 쿠키 재설정(+30초 스로틀 마커).
        // 캐시(쿠키) 경로면 이미 최신 쿠키가 브라우저에 있으므로 재기록 불필요.
        if (profile && !fromCache) {
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
          // 스로틀 마커 — 30초. 이 창 동안은 프로필 DB 조회를 건너뛴다.
          supabaseResponse.cookies.set('mp_fresh', '1', {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 30,
          });
        }
      }
    } else {
      // 비로그인 사용자가 인증 필요 경로에 접근 시 → /login?redirect={path+search} 로 통일
      // (기존: 개별 페이지에서 redirect(ROUTES.LOGIN) 만 호출해 원경로 유실)
      const needsAuth =
        !isPublicBypass &&
        (path.startsWith('/mypage') || path.startsWith('/applications') || path.startsWith('/jobs/new') || path.startsWith('/community/new'));
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
