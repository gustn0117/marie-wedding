/**
 * Supabase 세션 쿠키 이름을 **공개 URL 기준으로 고정**한다.
 *
 * 배경: supabase-js 는 storageKey(쿠키 이름)를 접속 URL 의 hostname 으로 유도한다
 *   → `sb-${new URL(url).hostname.split('.')[0]}-auth-token`.
 * hardening(16) 이후 서버 클라이언트는 내부 URL(http://kong:8000)로 접속하므로
 * `sb-kong-auth-token`, 브라우저는 https://api.hsweb.pics 라 `sb-api-auth-token` 이 되어
 * **세션 쿠키 이름이 서버↔브라우저 불일치** → OAuth 콜백(서버)이 쓴 세션을 브라우저가
 * 못 읽어 클라이언트 getSession/linkIdentity 전멸.
 *
 * 해결: 모든 createServerClient/createBrowserClient 에 이 이름을 cookieOptions.name 으로
 * 명시해, 접속 URL 과 무관하게 서버·브라우저가 **동일한 세션 쿠키**를 읽고 쓴다.
 * 값은 항상 브라우저가 접속하는 공개 URL(NEXT_PUBLIC_SUPABASE_URL) 기준으로 유도.
 */
export const SUPABASE_AUTH_COOKIE_NAME = `sb-${
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.hsweb.pics').hostname.split('.')[0]
}-auth-token`;
