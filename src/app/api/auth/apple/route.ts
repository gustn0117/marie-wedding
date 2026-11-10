import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveExternalOrigin } from '@/lib/proxy';
import { readBoundedJson } from '@/lib/bounded-json';
import { completeSocialLogin, sanitizeReturnTo } from '@/lib/auth/completeSocialLogin';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;
const NAME_MAX = 30;

/**
 * 애플 로그인(iOS 앱 전용). 앱이 네이티브 창으로 받은 애플 신분 토큰을 Supabase 세션으로 바꾼다.
 *
 * 앱(mobile/ios/App/App/AppleSignInPlugin.swift)은 사이트가 만든 nonce 를 SHA-256 으로 바꿔 애플에 보내고,
 * 사이트는 원래 nonce 와 토큰을 여기로 보낸다. GoTrue 가 토큰 서명·발급처·대상(aud = 앱 번들 ID
 * kr.co.marie.app, GOTRUE_EXTERNAL_APPLE_CLIENT_ID)·nonce 를 확인하고 세션 쿠키를 심는다.
 * 그 뒤는 카카오 콜백과 같은 마무리(completeSocialLogin)를 거쳐 갈 곳을 JSON 으로 돌려준다.
 *
 * 애플은 이름을 토큰에 싣지 않고 처음 승인할 때 한 번만 앱에 준다 → 앱이 받은 이름을 함께 넘긴다.
 */
export async function POST(request: Request) {
  const origin = resolveExternalOrigin(request);

  // 다른 사이트가 사용자를 몰래 로그인시키지 못하게 — 브라우저가 보낸 Origin 이 있으면 이 사이트여야 한다.
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== origin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const body = parsed.value as Record<string, unknown>;
  const identityToken = typeof body.identityToken === 'string' ? body.identityToken : '';
  const nonce = typeof body.nonce === 'string' ? body.nonce : '';
  if (!identityToken || identityToken.length > 8192 || nonce.length < 16 || nonce.length > 128) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const next = sanitizeReturnTo(typeof body.next === 'string' ? body.next : null) ?? '/jobs';
  const preferredName = appleDisplayName(body.givenName, body.familyName);

  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
  const cookieStore = await cookies();
  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
        }),
      },
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce,
  });
  if (error || !data.user) {
    console.error('[auth/apple] signInWithIdToken failed:', error?.status, error?.code, error?.message);
    return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
  }

  const outcome = await completeSocialLogin({
    user: data.user,
    cookieStore,
    serviceClient: createServiceClient(deadline),
    next,
    preferredName,
    logTag: 'auth/apple',
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 403 });
  }
  return NextResponse.json({ redirect: outcome.path });
}

/** 애플이 준 성·이름으로 표시 이름을 만든다. 한글이면 '홍길동', 그 밖에는 'Gildong Hong'. */
function appleDisplayName(given: unknown, family: unknown): string | null {
  const g = typeof given === 'string' ? given.trim() : '';
  const f = typeof family === 'string' ? family.trim() : '';
  if (!g && !f) return null;
  const hangul = /[가-힣]/.test(`${g}${f}`);
  const name = hangul ? `${f}${g}` : [g, f].filter(Boolean).join(' ');
  return name.slice(0, NAME_MAX);
}
