-- 탈퇴 시 이력서(PII 최다)를 빠뜨리던 것과, 재활성화 시 이름을 남기던 것 수정.

CREATE OR REPLACE FUNCTION marie_wedding.purge_profile_cascade(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_now timestamptz := NOW();
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT marie_wedding.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM marie_wedding.profiles
       WHERE id = p_profile_id AND user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'not_authorized_to_purge_profile';
  END IF;

  PERFORM set_config('marie_wedding.system_context', 'on', true);

  UPDATE marie_wedding.profiles
     SET deleted_at = COALESCE(deleted_at, v_now),
         is_directory_listed = false
   WHERE id = p_profile_id;

  UPDATE marie_wedding.jobs
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  UPDATE marie_wedding.posts
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  UPDATE marie_wedding.comments
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  UPDATE marie_wedding.applications
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE applicant_id = p_profile_id;

  UPDATE marie_wedding.reviews
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE reviewer_id = p_profile_id
      OR reviewee_id = p_profile_id;

  UPDATE marie_wedding.portfolios
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE profile_id = p_profile_id;

  -- 이력서: 이름·연락처·생년월일·주소·경력 등 PII 최다. 반드시 함께 soft delete.
  UPDATE marie_wedding.resumes
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE profile_id = p_profile_id;

  BEGIN DELETE FROM marie_wedding.notifications WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM marie_wedding.bookmarks WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM marie_wedding.saved_searches WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM marie_wedding.availability_slots WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM marie_wedding.reports WHERE reporter_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM marie_wedding.post_likes WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM marie_wedding.phone_otps WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  -- 이메일 인증 코드(일회용)도 함께 제거.
  BEGIN DELETE FROM marie_wedding.email_otps WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;

CREATE OR REPLACE FUNCTION marie_wedding.reactivate_profile_clean(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'marie_wedding', 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only';
  END IF;

  PERFORM set_config('marie_wedding.system_context', 'on', true);

  UPDATE marie_wedding.profiles
     SET deleted_at = NULL,
         onboarded_at = NULL,
         -- contact_name 은 NOT NULL 이라 NULL 불가 → 빈 문자열로 비운다.
         -- 온보딩에서 이름을 필수 재입력하므로 폼에 옛 이름이 prefill 되지 않는다.
         contact_name = '',
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

  -- 안전망: 탈퇴 때 이력서가 정리되지 않은 기존 계정이 재로그인하는 경우에도
  -- 여기서 확실히 soft delete 한다. (purge 수정 이전에 탈퇴한 계정 대응)
  UPDATE marie_wedding.resumes
     SET deleted_at = NOW()
   WHERE profile_id = p_profile_id
     AND deleted_at IS NULL;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;
