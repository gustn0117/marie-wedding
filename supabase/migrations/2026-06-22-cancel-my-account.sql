-- 회원이 직접 자기 계정을 비활성화하는 RPC (soft delete)
-- 2026-06-22
--
-- 자기 자신의 profile + 작성한 jobs/posts/comments를 soft delete.
-- auth.users 자체는 남김 (관리자가 admin 패널에서 purge_profile_cascade로 hard delete 가능).

CREATE OR REPLACE FUNCTION marie_wedding.cancel_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public, auth
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 본인 프로필 비활성화 + 디렉토리 비공개
  UPDATE marie_wedding.profiles
  SET deleted_at = NOW(),
      is_directory_listed = false
  WHERE id = v_profile_id;

  -- 본인이 작성한 콘텐츠 비공개 처리 (이미 삭제된 건 그대로)
  UPDATE marie_wedding.jobs
  SET deleted_at = COALESCE(deleted_at, NOW())
  WHERE author_id = v_profile_id;

  UPDATE marie_wedding.posts
  SET deleted_at = COALESCE(deleted_at, NOW())
  WHERE author_id = v_profile_id;

  UPDATE marie_wedding.comments
  SET deleted_at = COALESCE(deleted_at, NOW())
  WHERE author_id = v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION marie_wedding.cancel_my_account() TO authenticated;

NOTIFY pgrst, 'reload schema';
