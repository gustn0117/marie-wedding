-- purge_profile_cascade: 좋아요 삭제 시 like_count 재동기화 (sweep v4 #9)
-- 작성일: 2026-07-19
-- 20260718000100 원본 함수를 그대로 복제하고 post_likes 삭제 블록만 like_count 재동기화로 교체.

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
  -- 좋아요 삭제 시 해당 게시글 like_count 도 재동기화 (카운터 부풀림 방지 — sweep v4 #9).
  -- toggle_post_like RPC 가 카운터를 관리하므로 트리거 대신 여기서 직접 차감한다.
  BEGIN
    WITH del AS (
      DELETE FROM marie_wedding.post_likes WHERE profile_id = p_profile_id RETURNING post_id
    )
    UPDATE marie_wedding.posts p
       SET like_count = GREATEST(0, p.like_count - d.cnt)
      FROM (SELECT post_id, COUNT(*) AS cnt FROM del GROUP BY post_id) d
     WHERE p.id = d.post_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM marie_wedding.phone_otps WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  -- 이메일 인증 코드(일회용)도 함께 제거.
  BEGIN DELETE FROM marie_wedding.email_otps WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;
