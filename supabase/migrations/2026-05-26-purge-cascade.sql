-- 회원 cascade 삭제 RPC
-- 작성일: 2026-05-26
-- admin/users '삭제' 시 호출. profile + 본인이 작성한 콘텐츠/지원/리뷰 등을 모두 soft delete
-- (관계형 cascade로 묶이지 않은 부가 데이터는 hard delete)

CREATE OR REPLACE FUNCTION marie_wedding.purge_profile_cascade(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller_role marie_wedding.user_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- soft delete (deleted_at 컬럼 있는 테이블)
  UPDATE marie_wedding.jobs SET deleted_at = NOW()
    WHERE author_id = p_profile_id AND deleted_at IS NULL;
  UPDATE marie_wedding.posts SET deleted_at = NOW()
    WHERE author_id = p_profile_id AND deleted_at IS NULL;
  UPDATE marie_wedding.comments SET deleted_at = NOW()
    WHERE author_id = p_profile_id AND deleted_at IS NULL;
  UPDATE marie_wedding.applications SET deleted_at = NOW()
    WHERE applicant_id = p_profile_id AND deleted_at IS NULL;
  UPDATE marie_wedding.portfolios SET deleted_at = NOW()
    WHERE profile_id = p_profile_id AND deleted_at IS NULL;
  UPDATE marie_wedding.reviews SET deleted_at = NOW()
    WHERE (reviewer_id = p_profile_id OR reviewee_id = p_profile_id) AND deleted_at IS NULL;
  UPDATE marie_wedding.notifications SET deleted_at = NOW()
    WHERE profile_id = p_profile_id AND deleted_at IS NULL;

  -- hard delete (deleted_at 컬럼 없는 부가 테이블)
  DELETE FROM marie_wedding.post_likes WHERE profile_id = p_profile_id;
  DELETE FROM marie_wedding.bookmarks WHERE profile_id = p_profile_id;
  DELETE FROM marie_wedding.saved_searches WHERE profile_id = p_profile_id;
  DELETE FROM marie_wedding.availability_slots WHERE profile_id = p_profile_id;
  DELETE FROM marie_wedding.phone_otps WHERE profile_id = p_profile_id;

  -- 대화·메시지는 참여자가 사라지면 의미 없으므로 hard delete
  DELETE FROM marie_wedding.messages WHERE sender_id = p_profile_id;
  DELETE FROM marie_wedding.conversations
    WHERE participant_a = p_profile_id OR participant_b = p_profile_id;

  -- profile 본인 soft delete (복원 시 deleted_at만 해제하면 됨; 관련 콘텐츠는 별도 복원 필요)
  UPDATE marie_wedding.profiles SET deleted_at = NOW()
    WHERE id = p_profile_id;
END;
$$;

-- 복원 함수도 함께 제공 (콘텐츠는 함께 복원하지 않음 — admin 판단)
CREATE OR REPLACE FUNCTION marie_wedding.restore_profile_cascade(p_profile_id UUID, p_restore_content BOOLEAN DEFAULT FALSE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller_role marie_wedding.user_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  UPDATE marie_wedding.profiles SET deleted_at = NULL WHERE id = p_profile_id;

  IF p_restore_content THEN
    UPDATE marie_wedding.jobs SET deleted_at = NULL WHERE author_id = p_profile_id;
    UPDATE marie_wedding.posts SET deleted_at = NULL WHERE author_id = p_profile_id;
    UPDATE marie_wedding.comments SET deleted_at = NULL WHERE author_id = p_profile_id;
    UPDATE marie_wedding.applications SET deleted_at = NULL WHERE applicant_id = p_profile_id;
    UPDATE marie_wedding.portfolios SET deleted_at = NULL WHERE profile_id = p_profile_id;
    UPDATE marie_wedding.reviews SET deleted_at = NULL
      WHERE reviewer_id = p_profile_id OR reviewee_id = p_profile_id;
    UPDATE marie_wedding.notifications SET deleted_at = NULL WHERE profile_id = p_profile_id;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
