-- profiles.is_directory_listed 기본값 false → true.
-- 신규 가입자는 기본 디렉토리 공개 상태로. 숨기려면 본인이 명시적으로 토글.

ALTER TABLE marie_wedding.profiles
  ALTER COLUMN is_directory_listed SET DEFAULT true;

-- 백필 — 업체(business) 회원 중 현재 is_directory_listed=false 인 모든 row 를 true 로.
-- 사유: 기본값 false 라서 의도와 무관하게 숨겨진 사용자 대다수가 노출 안 됨.
-- (이 후 본인이 '공개 해제' 누르면 false 로 다시 전환됨)
UPDATE marie_wedding.profiles
   SET is_directory_listed = true,
       updated_at = NOW()
 WHERE deleted_at IS NULL
   AND account_type = 'business'
   AND is_directory_listed = false;

COMMENT ON COLUMN marie_wedding.profiles.is_directory_listed IS
  '디렉토리 노출 여부. 기본 true. 사용자가 명시적으로 숨기면 false. soft delete 시 trigger 가 자동 false.';
