import { nativeIdTokenLogin } from '@/lib/auth/nativeIdTokenLogin';

export const runtime = 'nodejs';

/**
 * 카카오톡 앱으로 로그인(iOS 앱 전용). 앱이 카카오톡에서 받아 온 카카오 ID 토큰을 Supabase 세션으로 바꾼다.
 *
 * 앱(mobile/ios/App/App/KakaoLoginPlugin.swift)은 카카오 SDK 로 카카오톡 앱을 열어 확인만 받고 돌아온다 —
 * 웹 로그인은 앱 화면 안에서 열려 휴대폰의 카카오톡 로그인 상태를 쓰지 못해 아이디·비밀번호를 다시 넣어야 했다.
 * 토큰의 aud 는 카카오 네이티브 앱 키라 GoTrue 의 GOTRUE_EXTERNAL_KAKAO_CLIENT_ID 에 'REST API 키,네이티브 앱 키'
 * 순서로 둘 다 있어야 한다(웹 로그인은 첫 값을 쓴다). 토큰은 카카오 개발자 콘솔에서 OpenID Connect 를 켜야 나온다.
 *
 * 사용자 연결은 웹 카카오 로그인과 같다 — GoTrue 가 카카오 회원번호(sub)로 같은 계정을 찾는다.
 */
export async function POST(request: Request) {
  return nativeIdTokenLogin(request, {
    provider: 'kakao',
    tokenField: 'idToken',
    logTag: 'auth/kakao',
  });
}
