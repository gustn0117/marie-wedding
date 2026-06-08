-- 보안 일괄 강화 (2026-06-08 코덱스 후속)
-- 1) profiles의 admin-only 컬럼(role, banned_*, admin_note, verification_status) 비-관리자 변경 차단
-- 2) ban_user/unban_user/set_admin_note SECURITY DEFINER RPC
-- 3) posts.adopted_comment_id SECURITY DEFINER RPC + 검증
-- 4) jobs/posts의 작성자 위변조(author_id, is_promoted, hidden_by_admin) 차단
-- 5) events.view_count 원자적 증가 RPC

-- ─────────────────────────────────────────────
-- 1. profiles 보호 컬럼 trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.protect_profile_admin_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
BEGIN
  -- 관리자는 모든 컬럼 변경 허용
  IF marie_wedding.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 비-관리자가 보호 컬럼을 바꾸려 하면 거부
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
    -- 인증 신청 트리거가 verification_status='pending'으로 바꾸는 정상 케이스 허용
    IF OLD.verification_status IS NULL AND NEW.verification_status = 'pending' THEN
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
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_cols ON marie_wedding.profiles;
CREATE TRIGGER protect_profile_admin_cols
  BEFORE UPDATE ON marie_wedding.profiles
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.protect_profile_admin_cols();

-- ─────────────────────────────────────────────
-- 2. ban_user / unban_user / set_admin_note RPC
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.ban_user(p_id UUID, p_reason TEXT)
RETURNS marie_wedding.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_profile marie_wedding.profiles%ROWTYPE;
BEGIN
  IF NOT marie_wedding.is_admin() THEN
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
$$;

CREATE OR REPLACE FUNCTION marie_wedding.unban_user(p_id UUID)
RETURNS marie_wedding.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_profile marie_wedding.profiles%ROWTYPE;
BEGIN
  IF NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE marie_wedding.profiles
  SET banned_at = NULL, banned_reason = NULL, banned_by = NULL
  WHERE id = p_id AND deleted_at IS NULL
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.set_admin_note(p_id UUID, p_note TEXT)
RETURNS marie_wedding.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_profile marie_wedding.profiles%ROWTYPE;
BEGIN
  IF NOT marie_wedding.is_admin() THEN
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
$$;

-- ─────────────────────────────────────────────
-- 3. set_adopted_comment RPC
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.set_adopted_comment(p_post_id UUID, p_comment_id UUID)
RETURNS marie_wedding.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_post marie_wedding.posts%ROWTYPE;
  v_comment marie_wedding.comments%ROWTYPE;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- 채택 해제 (p_comment_id IS NULL) 도 허용
  IF p_comment_id IS NOT NULL THEN
    SELECT * INTO v_comment
    FROM marie_wedding.comments
    WHERE id = p_comment_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'comment_not_found';
    END IF;

    IF v_comment.post_id <> p_post_id THEN
      RAISE EXCEPTION 'comment_post_mismatch';
    END IF;

    IF v_comment.author_id = v_caller THEN
      RAISE EXCEPTION 'cannot_adopt_own_comment';
    END IF;
  END IF;

  UPDATE marie_wedding.posts
  SET adopted_comment_id = p_comment_id
  WHERE id = p_post_id
    AND author_id = v_caller
    AND deleted_at IS NULL
  RETURNING * INTO v_post;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_not_found_or_not_author';
  END IF;

  RETURN v_post;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. posts/jobs 보호 컬럼 trigger (author_id·is_promoted·hidden_by_admin)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.protect_post_admin_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
BEGIN
  IF marie_wedding.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'protected_column_modified: author_id';
  END IF;
  IF NEW.is_promoted IS DISTINCT FROM OLD.is_promoted THEN
    RAISE EXCEPTION 'protected_column_modified: is_promoted';
  END IF;
  IF NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
    RAISE EXCEPTION 'protected_column_modified: hidden_by_admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_post_admin_cols ON marie_wedding.posts;
CREATE TRIGGER protect_post_admin_cols
  BEFORE UPDATE ON marie_wedding.posts
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.protect_post_admin_cols();

CREATE OR REPLACE FUNCTION marie_wedding.protect_job_admin_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
BEGIN
  IF marie_wedding.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'protected_column_modified: author_id';
  END IF;
  IF NEW.is_promoted IS DISTINCT FROM OLD.is_promoted THEN
    RAISE EXCEPTION 'protected_column_modified: is_promoted';
  END IF;
  IF NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
    RAISE EXCEPTION 'protected_column_modified: hidden_by_admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_job_admin_cols ON marie_wedding.jobs;
CREATE TRIGGER protect_job_admin_cols
  BEFORE UPDATE ON marie_wedding.jobs
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.protect_job_admin_cols();

-- ─────────────────────────────────────────────
-- 5. events.view_count 원자적 증가 RPC
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.increment_event_view_count(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
BEGIN
  UPDATE marie_wedding.events
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_event_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
