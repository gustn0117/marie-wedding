-- ===================================================================
-- hardening(11): profiles.cover_image 컬럼 추가
-- ===================================================================
-- 배경: 프로필 이미지(로고, 정사각) 와 커버 이미지(가로 배너) 분리.
-- - profile_image: 로고/아바타 (기존)  — 800×800 정사각 권장
-- - cover_image  : 커버 배너 (신규)   — 1600×900 가로 권장, 상세 페이지 히어로 배경
-- ===================================================================

ALTER TABLE marie_wedding.profiles
  ADD COLUMN IF NOT EXISTS cover_image text;

COMMENT ON COLUMN marie_wedding.profiles.cover_image IS
  '커버(가로 배너) 이미지 storage 경로. 디렉토리 카드/상세 페이지 상단에 표시.';

-- reactivate_profile_clean 확장 — 탈퇴→재로그인 시 cover_image 도 초기화
CREATE OR REPLACE FUNCTION marie_wedding.reactivate_profile_clean(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
BEGIN
  PERFORM set_config('marie_wedding.system_context', 'on', true);

  UPDATE marie_wedding.profiles
     SET
       deleted_at = NULL,
       onboarded_at = NULL,
       account_type = NULL,
       business_type = NULL,
       company_name = NULL,
       region = NULL,
       bio = NULL,
       phone = NULL,
       phone_verified = false,
       phone_verified_at = NULL,
       website = NULL,
       profile_image = NULL,
       cover_image = NULL,
       company_size = NULL,
       established_year = NULL,
       address = NULL,
       gallery = NULL,
       is_directory_listed = false,
       verification_status = 'unverified',
       verification_document = NULL,
       verification_submitted_at = NULL,
       verification_reviewed_at = NULL,
       verification_reject_reason = NULL,
       business_number = NULL,
       verified_at = NULL,
       response_rate = 0,
       avg_response_minutes = NULL,
       completed_deals_count = 0,
       premium_tier = 'free',
       premium_until = NULL,
       banned_at = NULL,
       banned_reason = NULL,
       banned_by = NULL,
       admin_note = NULL,
       updated_at = NOW()
   WHERE id = p_profile_id;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;
