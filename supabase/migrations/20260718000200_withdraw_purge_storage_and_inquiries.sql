-- 탈퇴/삭제 시 (1) 소유 Storage 파일이 영원히 잔존하고 (2) 고객센터 문의 PII 가
-- 남던 문제 수정. purge_profile_cascade 가 avatars(프로필사진/커버/갤러리)와
-- resume-files(이력서사진/포트폴리오PDF) 참조 컬럼을 NULL 로 비워, 소프트삭제 행이
-- 더 이상 그 경로를 참조하지 않게 한다 → storage-orphan-cleanup 가 회수 가능.
-- (즉시 삭제가 필요한 공개 avatars 는 withdraw 라우트에서 별도로 즉시 remove.)
-- support_inquiries 는 deleted_at 이 없어 hard-delete 로 PII 제거.

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

  -- 프로필 소프트삭제 + 공개 avatars 참조 컬럼 비우기(고아정리가 회수하도록).
  UPDATE marie_wedding.profiles
     SET deleted_at = COALESCE(deleted_at, v_now),
         is_directory_listed = false,
         profile_image = NULL,
         cover_image = NULL,
         gallery = NULL
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

  -- 이력서: PII 최다. soft delete + resume-files 참조(사진/PDF첨부) 비우기.
  -- 제출 지원서의 application_resume_snapshots 는 별도 행에 사진/첨부 경로 사본을
  -- 보유하므로, 업체가 봐야 할 제출본 파일은 스냅샷 참조로 계속 보호된다.
  UPDATE marie_wedding.resumes
     SET deleted_at = COALESCE(deleted_at, v_now),
         photo_path = NULL,
         attachments = '[]'::jsonb
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
  BEGIN DELETE FROM marie_wedding.email_otps WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  -- 고객센터 문의: 실명·전화·이메일 PII. deleted_at 컬럼이 없어 hard-delete.
  BEGIN DELETE FROM marie_wedding.support_inquiries WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;
