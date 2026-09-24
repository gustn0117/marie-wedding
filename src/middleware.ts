import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { SITE_HOST, SITE_URL } from '@/shared/seo';

// nginx 가 Host / X-Forwarded-Host 에 실제 접속 호스트를 넘긴다(nginx/default.conf).
function requestHost(request: NextRequest): string {
  return (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();
}

export async function middleware(request: NextRequest) {
  // 검색엔진이 정본(marie.co.kr) 하나만 보게 한다.
  // www 는 같은 화면을 200 으로 내주고 있어 중복 URL 이 된다 → 페이지 요청만 301.
  // API·OAuth 콜백(/api, /auth)과 POST 는 건드리지 않는다(쿠키·폼 전송이 끊기지 않게).
  const host = requestHost(request);
  const path = request.nextUrl.pathname;
  if (
    host === `www.${SITE_HOST}`
    && (request.method === 'GET' || request.method === 'HEAD')
    && !path.startsWith('/api/')
    && !path.startsWith('/auth/')
  ) {
    return NextResponse.redirect(`${SITE_URL}${path}${request.nextUrl.search}`, 301);
  }

  const response = await updateSession(request);
  // 운영 보조 호스트(marie-wedding.hsweb.pics — 이메일 링크·프록시용)는 서비스는 그대로 두고 색인만 막는다.
  if (host.endsWith('.hsweb.pics')) response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
