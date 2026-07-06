-- ===================================================================
-- 트리거 3개 근본 수정 (Batch 1)
-- ===================================================================

-- (1) protect_profile_admin_cols: verification 신청 도달 불가 문제
--     기존: OLD.verification_status IS NULL 은 컬럼 DEFAULT 'unverified' NOT NULL 이라 발생 안 함
--     수정: 'unverified' 도 허용
CREATE OR REPLACE FUNCTION marie_wedding.protect_profile_admin_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
BEGIN
  IF marie_wedding.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'protected_column_modified: role';
  END IF;
  IF NEW.banned_at IS DISTINCT FROM OLD.banned_at THEN
    RAISE EXCEPTION 'protected_column_modified: banned_at';
  END IF;
  IF NEW.banned_reason IS DISTINCT FROM OLD.banned_reason THEN
    RAISE EXCEPTION 'protected_column_modified: banned_reason';
  END IF;
  IF NEW.banned_by IS DISTINCT FROM OLD.banned_by THEN
    RAISE EXCEPTION 'protected_column_modified: banned_by';
  END IF;
  IF NEW.admin_note IS DISTINCT FROM OLD.admin_note THEN
    RAISE EXCEPTION 'protected_column_modified: admin_note';
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    -- 신청 정상 케이스: unverified/NULL → pending
    IF (OLD.verification_status IS NULL OR OLD.verification_status = 'unverified')
       AND NEW.verification_status = 'pending' THEN
      -- ok
    ELSE
      RAISE EXCEPTION 'protected_column_modified: verification_status';
    END IF;
  END IF;
  IF NEW.premium_tier IS DISTINCT FROM OLD.premium_tier THEN
    RAISE EXCEPTION 'protected_column_modified: premium_tier';
  END IF;

  RETURN NEW;
END;
$function$;

-- (2) auto_moderate_job / auto_moderate_post: 매 편집마다 다시 hidden 세팅 문제
--     기존: BEFORE INSERT OR UPDATE OF title, description  — 매 편집마다 hidden_by_admin=TRUE 재설정
--     수정: INSERT 만 처리 + UPDATE 는 관련 텍스트가 실제로 바뀐 경우에만
CREATE OR REPLACE FUNCTION marie_wedding.auto_moderate_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_matched_keyword text;
  v_content text;
BEGIN
  -- INSERT 는 항상 검사. UPDATE 는 title/description 이 실제로 바뀐 경우만.
  IF TG_OP = 'UPDATE'
     AND NEW.title = OLD.title
     AND NEW.description = OLD.description THEN
    RETURN NEW;
  END IF;

  v_content := lower(coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''));
  SELECT keyword INTO v_matched_keyword
  FROM marie_wedding.moderation_keywords
  WHERE scope IN ('job', 'all')
    AND action = 'hide'
    AND position(lower(keyword) IN v_content) > 0
  LIMIT 1;

  IF v_matched_keyword IS NOT NULL THEN
    NEW.hidden_by_admin := TRUE;
  END IF;
  RETURN NEW;
END;
$function$;

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

-- (3) protect_job_admin_cols: 시스템 트리거(auto_hide_job_on_reports) context 예외
--     기존: is_admin() 만 확인 → 시스템 트리거가 auth.uid()=일반 사용자 context 에서 실행되면 실패
--     수정: current_user='service_role' 또는 SECURITY DEFINER 함수 안에서 실행 시 통과
CREATE OR REPLACE FUNCTION marie_wedding.protect_job_admin_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
BEGIN
  -- 관리자 또는 service_role 또는 SECURITY DEFINER 시스템 함수 → 모든 컬럼 변경 허용
  IF marie_wedding.is_admin()
     OR current_user IN ('service_role', 'supabase_admin', 'postgres')
     OR current_setting('marie_wedding.system_context', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
    RAISE EXCEPTION 'protected_column_modified: hidden_by_admin';
  END IF;
  IF NEW.is_promoted IS DISTINCT FROM OLD.is_promoted THEN
    RAISE EXCEPTION 'protected_column_modified: is_promoted';
  END IF;
  IF NEW.promoted_until IS DISTINCT FROM OLD.promoted_until THEN
    RAISE EXCEPTION 'protected_column_modified: promoted_until';
  END IF;
  IF NEW.featured_at IS DISTINCT FROM OLD.featured_at THEN
    RAISE EXCEPTION 'protected_column_modified: featured_at';
  END IF;
  IF NEW.featured_order IS DISTINCT FROM OLD.featured_order THEN
    RAISE EXCEPTION 'protected_column_modified: featured_order';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'protected_column_modified: author_id';
  END IF;

  RETURN NEW;
END;
$function$;

-- protect_post_admin_cols 도 동일 패턴 적용
CREATE OR REPLACE FUNCTION marie_wedding.protect_post_admin_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
BEGIN
  IF marie_wedding.is_admin()
     OR current_user IN ('service_role', 'supabase_admin', 'postgres')
     OR current_setting('marie_wedding.system_context', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
    RAISE EXCEPTION 'protected_column_modified: hidden_by_admin';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'protected_column_modified: author_id';
  END IF;

  RETURN NEW;
END;
$function$;
