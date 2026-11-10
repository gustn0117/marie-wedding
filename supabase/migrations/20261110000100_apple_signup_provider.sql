-- 애플 로그인 다시 허용 — iOS 앱(mobile/)은 카카오·네이버 로그인을 쓰므로 앱스토어 심사 기준(4.8)상
-- 애플 로그인을 같이 제공해야 한다. 앱에서만 보이며, 네이티브 신분 토큰을 /api/auth/apple 이 세션으로 바꾼다.
-- 2026-06-19 drop-apple-provider 에서 뺀 'apple' 을 가입 경로 CHECK 제약에 되돌린다.
-- 허용 값만 늘리는 변경이라 배포 중 이전 버전과 함께 돌아도 안전하다.

ALTER TABLE marie_wedding.profiles
  DROP CONSTRAINT IF EXISTS profiles_signup_provider_check;

ALTER TABLE marie_wedding.profiles
  ADD CONSTRAINT profiles_signup_provider_check
    CHECK (signup_provider IS NULL OR signup_provider IN ('email','kakao','google','naver','apple'));
