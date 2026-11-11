import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveExternalOrigin } from '@/lib/proxy';
import { readBoundedJson } from '@/lib/bounded-json';
import { completeSocialLogin, sanitizeReturnTo } from '@/lib/auth/completeSocialLogin';

const MAX_BODY_BYTES = 16 * 1024;

/**
 * iOS 앱 네이티브 로그인(애플 /api/auth/apple, 카카오톡 /api/auth/kakao)의 공통 처리.
 * 앱이 받은 신분 토큰(OIDC ID 토큰)을 Supabase 세션으로 바꾼다.
 *
 * 앱은 사이트가 만든 nonce 를 SHA-256 으로 바꿔 애플·카카오에 보내고, 사이트는 원래 nonce 와 토큰을 여기로 보낸다.
 * GoTrue(signInWithIdToken)가 토큰 서명·발급처·대상(aud)·nonce 를 확인하고 세션 쿠키를 심는다.
 *  · 애플 aud = 앱 번들 ID(GOTRUE_EXTERNAL_APPLE_CLIENT_ID)
 *  · 카카오 aud = 카카오 네이티브 앱 키(GOTRUE_EXTERNAL_KAKAO_CLIENT_ID 의 두 번째 값. 첫 값은 웹 로그인이 쓰는 REST API 키)
 * 그 뒤는 카카오 웹 콜백과 같은 마무리(completeSocialLogin)를 거쳐 갈 곳을 JSON 으로 돌려준다.
 */
export async function nativeIdTokenLogin(
  request: Request,
  opts: {
    provider: 'apple' | 'kakao';
    /** 요청 본문에서 토큰이 든 칸 이름 */
    tokenField: string;
    logTag: string;
    /** 새 프로필에 넣을 이름 — 애플은 이름을 토큰에 싣지 않고 처음 승인할 때 한 번만 앱에 준다. */
    preferredName?: (body: Record<string, unknown>) => string | null;
  },
): Promise<NextResponse> {
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
  const rawToken = body[opts.tokenField];
  const token = typeof rawToken === 'string' ? rawToken : '';
  const nonce = typeof body.nonce === 'string' ? body.nonce : '';
  if (!token || token.length > 8192 || nonce.length < 16 || nonce.length > 128) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const next = sanitizeReturnTo(typeof body.next === 'string' ? body.next : null) ?? '/jobs';
  const preferredName = opts.preferredName?.(body) ?? null;

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
    provider: opts.provider,
    token,
    nonce,
  });
  if (error || !data.user) {
    console.error(`[${opts.logTag}] signInWithIdToken failed:`, error?.status, error?.code, error?.message);
    return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
  }

  const outcome = await completeSocialLogin({
    user: data.user,
    cookieStore,
    serviceClient: createServiceClient(deadline),
    next,
    preferredName,
    logTag: opts.logTag,
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 403 });
  }
  return NextResponse.json({ redirect: outcome.path });
}
