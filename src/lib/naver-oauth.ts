import crypto from 'crypto';

/**
 * 네이버 자체 OAuth 어댑터.
 *
 * Supabase는 2026년 6월 현재 네이버 provider를 native 지원하지 않으므로 자체 라우트로 처리한다.
 * 보안 핵심:
 *   - state는 32바이트 random + HMAC. cookie에 raw 저장, query는 signed 형식.
 *   - cookie는 __Host- prefix + HttpOnly + Secure + SameSite=Lax + maxAge 600s + path 한정 + 1회용.
 *   - 모든 호출은 node runtime (Edge 미지원).
 *   - client_secret은 서버에서만, 절대 NEXT_PUBLIC_ 금지.
 */

const NAVER_AUTH_URL = 'https://nid.naver.com/oauth2.0/authorize';
const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_USERINFO_URL = 'https://openapi.naver.com/v1/nid/me';

export const NAVER_STATE_COOKIE = '__Host-naver_oauth_state';
export const NAVER_STATE_COOKIE_PATH = '/auth/naver';
export const NAVER_STATE_COOKIE_MAX_AGE = 600;

export interface NaverUserInfo {
  id: string;
  email?: string;
  name?: string;
  mobile?: string;
  nickname?: string;
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getStateSecret(): string {
  return getEnv('NAVER_OAUTH_STATE_SECRET');
}

function getRedirectUri(origin: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;
  return `${base}/auth/naver/callback`;
}

/**
 * state pair 생성.
 * - rawState: cookie에 저장 (HMAC 비교 기준)
 * - signedState: redirect URL의 ?state=에 포함 (HMAC 결과)
 */
export function generateState(): { rawState: string; signedState: string } {
  const rawState = crypto.randomBytes(32).toString('hex');
  const signedState = signState(rawState);
  return { rawState, signedState };
}

function signState(rawState: string): string {
  return crypto
    .createHmac('sha256', getStateSecret())
    .update(rawState)
    .digest('hex');
}

/**
 * cookie의 rawState와 query의 signedState 비교 (상수 시간).
 */
export function verifyState(rawState: string | undefined, signedState: string | undefined): boolean {
  if (!rawState || !signedState) return false;
  const expected = signState(rawState);
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(signedState, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function buildAuthorizationUrl(origin: string, signedState: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getEnv('NAVER_CLIENT_ID'),
    redirect_uri: getRedirectUri(origin),
    state: signedState,
  });
  return `${NAVER_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  origin: string,
  code: string,
  signedState: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getEnv('NAVER_CLIENT_ID'),
    client_secret: getEnv('NAVER_CLIENT_SECRET'),
    code,
    state: signedState,
    redirect_uri: getRedirectUri(origin),
  });

  const res = await fetch(`${NAVER_TOKEN_URL}?${params.toString()}`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`Naver token exchange failed (status=${res.status})`);
  }
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string;
    error?: string;
    error_description?: string;
  };
  if (body.error || !body.access_token) {
    throw new Error(`Naver token error: ${body.error ?? 'no_access_token'}`);
  }
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in ? Number(body.expires_in) : undefined,
  };
}

export async function fetchUserInfo(accessToken: string): Promise<NaverUserInfo> {
  const res = await fetch(NAVER_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Naver userinfo failed (status=${res.status})`);
  }
  const body = (await res.json()) as {
    resultcode: string;
    message: string;
    response?: Record<string, string>;
  };
  if (body.resultcode !== '00' || !body.response) {
    throw new Error(`Naver userinfo error: ${body.message}`);
  }
  const r = body.response;
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    mobile: r.mobile,
    nickname: r.nickname,
  };
}

/**
 * naver_sub로부터 임시 가상 이메일 생성 (이메일 미제공 시).
 * 사용자가 /onboarding/email-required에서 실제 이메일을 입력하고 OTP 인증 후 교체된다.
 */
export function placeholderEmailFor(naverSub: string): string {
  return `naver_${naverSub}@social.marie.local`;
}
