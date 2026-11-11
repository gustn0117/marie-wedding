import { nativeIdTokenLogin } from '@/lib/auth/nativeIdTokenLogin';

export const runtime = 'nodejs';

const NAME_MAX = 30;

/**
 * 애플 로그인(iOS 앱 전용). 앱이 네이티브 창으로 받은 애플 신분 토큰을 Supabase 세션으로 바꾼다.
 *
 * 앱(mobile/ios/App/App/AppleSignInPlugin.swift)은 사이트가 만든 nonce 를 SHA-256 으로 바꿔 애플에 보내고,
 * 사이트는 원래 nonce 와 토큰을 여기로 보낸다. GoTrue 가 토큰 서명·발급처·대상(aud = 앱 번들 ID
 * kr.co.marie.app, GOTRUE_EXTERNAL_APPLE_CLIENT_ID)·nonce 를 확인하고 세션 쿠키를 심는다.
 * 확인·마무리는 카카오톡 앱 로그인과 같이 쓰는 nativeIdTokenLogin 에 있다.
 *
 * 애플은 이름을 토큰에 싣지 않고 처음 승인할 때 한 번만 앱에 준다 → 앱이 받은 이름을 함께 넘긴다.
 */
export async function POST(request: Request) {
  return nativeIdTokenLogin(request, {
    provider: 'apple',
    tokenField: 'identityToken',
    logTag: 'auth/apple',
    preferredName: (body) => appleDisplayName(body.givenName, body.familyName),
  });
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
