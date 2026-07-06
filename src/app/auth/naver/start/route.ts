import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  buildAuthorizationUrl,
  generateState,
  NAVER_STATE_COOKIE,
  NAVER_STATE_COOKIE_MAX_AGE,
  NAVER_STATE_COOKIE_PATH,
} from '@/lib/naver-oauth';
import { resolveExternalOrigin } from '@/lib/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 네이버 OAuth 진입점.
 * 1. state pair 생성
 * 2. rawState를 __Host-naver_oauth_state cookie에 저장 (1회용, 10분 만료)
 * 3. nid.naver.com/oauth2.0/authorize로 redirect (signedState를 ?state=에 포함)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Cloudflare tunnel / Docker 내부 바인딩(0.0.0.0:3000)을 피하기 위해
  // X-Forwarded-Host 우선으로 외부 origin 검출.
  const origin = resolveExternalOrigin(request);
  const requestedNext = searchParams.get('next');
  const next = sanitizeReturnTo(requestedNext) ?? '/jobs';

  try {
    const { rawState, signedState } = generateState();

    const cookieStore = await cookies();
    cookieStore.set(NAVER_STATE_COOKIE, rawState, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: NAVER_STATE_COOKIE_PATH,
      maxAge: NAVER_STATE_COOKIE_MAX_AGE,
    });
    // next 경로도 함께 cookie로 — state에 묶지 않고 분리 저장 (state는 순수 검증값으로 유지)
    cookieStore.set('naver_oauth_next', next, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: NAVER_STATE_COOKIE_PATH,
      maxAge: NAVER_STATE_COOKIE_MAX_AGE,
    });

    const authUrl = buildAuthorizationUrl(origin, signedState);
    return NextResponse.redirect(authUrl);
  } catch {
    // env 누락(NAVER_CLIENT_ID/SECRET/STATE_SECRET) 등 — generic
    return NextResponse.redirect(`${origin}/login?error=naver_config`);
  }
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}

