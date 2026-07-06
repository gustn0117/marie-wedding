-- ===================================================================
-- Batch 2: 회원 탈퇴/관리자 삭제 통일 cascade
-- ===================================================================

-- profiles.deleted_at 세팅 시 관련 컬렉션 전체 soft delete
CREATE OR REPLACE FUNCTION marie_wedding.purge_profile_cascade(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_now timestamptz := NOW();
BEGIN
  -- 시스템 컨텍스트 마킹 (protect trigger 통과)
  PERFORM set_config('marie_wedding.system_context', 'on', true);

  -- 1) profile 본체 (이미 세팅됐어도 idempotent)
  UPDATE marie_wedding.profiles
     SET deleted_at = COALESCE(deleted_at, v_now),
         is_directory_listed = false
   WHERE id = p_profile_id;

  -- 2) 작성 콘텐츠
  UPDATE marie_wedding.jobs
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  UPDATE marie_wedding.posts
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  UPDATE marie_wedding.comments
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  -- 3) 지원 이력
  UPDATE marie_wedding.applications
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE applicant_id = p_profile_id;

  -- 4) 리뷰 (양방향)
  UPDATE marie_wedding.reviews
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE reviewer_id = p_profile_id
      OR reviewee_id = p_profile_id;

  -- 5) 포트폴리오
  UPDATE marie_wedding.portfolios
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE profile_id = p_profile_id;

  -- 6) 알림 (본인이 받은 알림) — deleted_at 컬럼 있으면 세팅, 없으면 하드 삭제
  BEGIN
    UPDATE marie_wedding.notifications
       SET deleted_at = COALESCE(deleted_at, v_now)
     WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_column THEN
    DELETE FROM marie_wedding.notifications WHERE profile_id = p_profile_id;
  END;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;

-- cancel_my_account 을 새 RPC 를 쓰도록 갱신
CREATE OR REPLACE FUNCTION marie_wedding.cancel_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public', 'auth'
AS $function$
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

  PERFORM marie_wedding.purge_profile_cascade(v_profile_id);
END;
$function$;

COMMENT ON FUNCTION marie_wedding.purge_profile_cascade(uuid) IS
  '프로필 및 모든 관련 콘텐츠 (jobs/posts/comments/applications/reviews/portfolios/notifications) 를 idempotent 하게 soft delete. withdraw + admin 양쪽에서 호출.';
