/**
 * 현재 화면으로 돌아오는 로그인 링크.
 *
 * 상세 페이지가 비로그인에 공개된 뒤로 로그인 유도는 화면 안 CTA 가 담당한다.
 * 그런데 그냥 /login 으로 보내면 로그인 후 홈으로 가버려서, 보던 공고·글을 잃는다.
 * (미들웨어는 쓰기 경로에서만 redirect 를 붙여준다)
 */
export function loginHref(pathname?: string): string {
  const target = pathname
    ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '');
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/login';
  return `/login?redirect=${encodeURIComponent(target)}`;
}
