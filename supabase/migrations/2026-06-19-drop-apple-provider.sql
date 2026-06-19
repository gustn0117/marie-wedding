-- Apple provider 제거
-- 2026-06-19
--
-- 운영 정책상 Apple 로그인을 지원하지 않기로 결정.
-- CHECK 제약에서 'apple'을 제거하고, 혹시 남아있을 기존 row를 'email'로 정정.

SET search_path = marie_wedding, public;

-- 잔존 row 정정 (현재는 0건일 것)
UPDATE marie_wedding.profiles
SET signup_provider = 'email'
WHERE signup_provider = 'apple';

-- CHECK 제약 재정의
ALTER TABLE marie_wedding.profiles
  DROP CONSTRAINT IF EXISTS profiles_signup_provider_check;

ALTER TABLE marie_wedding.profiles
  ADD CONSTRAINT profiles_signup_provider_check
    CHECK (signup_provider IS NULL OR signup_provider IN ('email','kakao','google','naver'));
