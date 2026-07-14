-- Password-admin operations run through HMAC-protected Next.js routes and a
-- service-role Supabase client. Keep the database functions callable only from
-- that trusted server path and explicitly admit the service_role JWT.

BEGIN;

-- 일부 운영 DB에는 수동으로 존재하지만 초기 schema/migration 이력에는 빠져 있었다.
-- fresh rebuild에서도 공지 조회·자동 moderation trigger가 동일하게 동작하게 한다.
ALTER TABLE marie_wedding.posts
  ADD COLUMN IF NOT EXISTS is_notice BOOLEAN NOT NULL DEFAULT FALSE,
  ALTER COLUMN author_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_notice_created
  ON marie_wedding.posts(is_notice DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- 운영 공지는 관리자가 금칙어 자체를 안내/인용할 수 있으므로 일반 커뮤니티
-- 자동 숨김 대상에서 제외한다. 그렇지 않으면 INSERT 성공 직후 목록에서 사라진다.
CREATE OR REPLACE FUNCTION marie_wedding.auto_moderate_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_matched_keyword text;
  v_content text;
BEGIN
  IF NEW.is_notice THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.title = OLD.title
     AND NEW.content = OLD.content THEN
    RETURN NEW;
  END IF;

  v_content := lower(coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,''));
  SELECT keyword INTO v_matched_keyword
  FROM marie_wedding.moderation_keywords
  WHERE scope IN ('post', 'all')
    AND action = 'hide'
    AND position(lower(keyword) IN v_content) > 0
  LIMIT 1;

  IF v_matched_keyword IS NOT NULL THEN
    NEW.deleted_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$;

-- 결제 상태 변경 SECURITY DEFINER RPC는 웹훅 검증을 마친 서버에서만 호출한다.
-- PostgreSQL의 기본 PUBLIC EXECUTE를 제거하지 않으면 익명 RPC가 결제 완료 트리거를
-- 직접 실행해 프리미엄/공고 프로모션을 무단 활성화할 수 있다.
REVOKE ALL ON FUNCTION marie_wedding.create_payment_session(uuid, text, uuid, integer, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marie_wedding.mark_payment_completed(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marie_wedding.mark_payment_failed(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marie_wedding.create_payment_session(uuid, text, uuid, integer, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.mark_payment_completed(uuid, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.mark_payment_failed(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION marie_wedding.restore_profile_cascade(
  p_profile_id uuid,
  p_restore_content boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_profile_deleted_at timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT deleted_at
  INTO v_profile_deleted_at
  FROM marie_wedding.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE marie_wedding.profiles
  SET deleted_at = NULL
  WHERE id = p_profile_id;

  -- purge_profile_cascade는 당시 활성 상태였던 자식 row에 프로필과 동일한
  -- transaction timestamp를 기록한다. 그 timestamp만 복원해야 purge 전부터
  -- 사용자가 삭제했거나 운영진이 숨긴 콘텐츠가 되살아나지 않는다.
  IF p_restore_content AND v_profile_deleted_at IS NOT NULL THEN
    UPDATE marie_wedding.jobs SET deleted_at = NULL
      WHERE author_id = p_profile_id AND deleted_at = v_profile_deleted_at;
    UPDATE marie_wedding.posts SET deleted_at = NULL
      WHERE author_id = p_profile_id AND deleted_at = v_profile_deleted_at;
    UPDATE marie_wedding.comments SET deleted_at = NULL
      WHERE author_id = p_profile_id AND deleted_at = v_profile_deleted_at;
    UPDATE marie_wedding.applications SET deleted_at = NULL
      WHERE applicant_id = p_profile_id AND deleted_at = v_profile_deleted_at;
    UPDATE marie_wedding.portfolios SET deleted_at = NULL
      WHERE profile_id = p_profile_id AND deleted_at = v_profile_deleted_at;
    UPDATE marie_wedding.reviews SET deleted_at = NULL
      WHERE (reviewer_id = p_profile_id OR reviewee_id = p_profile_id)
        AND deleted_at = v_profile_deleted_at;
  END IF;
END;
$function$;

-- reactivate_profile_clean은 auth callback의 service-role 경로에서만 사용한다.
-- 기존 함수는 SECURITY DEFINER이면서 caller 검증/EXECUTE 제한이 없어, 위
-- system_context trigger bypass와 결합하면 임의 프로필의 인증·제재·유료 상태를
-- 초기화할 수 있었다. 최신 함수 본문(cover_image 포함)은 유지하고 입구만 닫는다.
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

CREATE OR REPLACE FUNCTION marie_wedding.ban_user(p_id uuid, p_reason text)
RETURNS marie_wedding.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_caller uuid;
  v_profile marie_wedding.profiles%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller = p_id THEN
    RAISE EXCEPTION 'cannot_ban_self';
  END IF;

  UPDATE marie_wedding.profiles
  SET banned_at = now(),
      banned_reason = COALESCE(NULLIF(TRIM(p_reason), ''), '운영진 판단에 의한 제재'),
      banned_by = v_caller
  WHERE id = p_id AND deleted_at IS NULL
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN v_profile;
END;
$function$;

CREATE OR REPLACE FUNCTION marie_wedding.unban_user(p_id uuid)
RETURNS marie_wedding.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_profile marie_wedding.profiles%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE marie_wedding.profiles
  SET banned_at = NULL,
      banned_reason = NULL,
      banned_by = NULL
  WHERE id = p_id AND deleted_at IS NULL
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN v_profile;
END;
$function$;

CREATE OR REPLACE FUNCTION marie_wedding.set_admin_note(p_id uuid, p_note text)
RETURNS marie_wedding.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_profile marie_wedding.profiles%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE marie_wedding.profiles
  SET admin_note = NULLIF(TRIM(p_note), '')
  WHERE id = p_id AND deleted_at IS NULL
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN v_profile;
END;
$function$;

-- purge_profile_cascade already distinguishes signed-in users from server
-- calls. Removing anon/PUBLIC execute closes the auth.uid() IS NULL anon path.
REVOKE ALL ON FUNCTION marie_wedding.purge_profile_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION marie_wedding.purge_profile_cascade(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION marie_wedding.restore_profile_cascade(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marie_wedding.reactivate_profile_clean(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marie_wedding.ban_user(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marie_wedding.unban_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marie_wedding.set_admin_note(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION marie_wedding.restore_profile_cascade(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.reactivate_profile_clean(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.ban_user(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.unban_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.set_admin_note(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
