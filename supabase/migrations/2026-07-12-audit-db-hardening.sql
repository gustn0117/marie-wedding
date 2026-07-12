-- ===================================================================
-- hardening(18): 전체 감사 — DB 레이어 확정 수정
-- ===================================================================

-- ── #41: set_application_status 상태 전이 가드 ──────────────────────
-- 문제: cancelled(지원자만 설정하는 종료상태) 부활, 완료된 거래 상태 뒤집기 가능.
CREATE OR REPLACE FUNCTION marie_wedding.set_application_status(p_application_id uuid, p_status text)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_caller UUID;
  v_app marie_wedding.applications%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_app
  FROM marie_wedding.applications
  WHERE id = p_application_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  SELECT * INTO v_job
  FROM marie_wedding.jobs
  WHERE id = v_app.job_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_caller = v_job.author_id THEN
    IF p_status NOT IN ('reviewing', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'status_not_allowed_for_author';
    END IF;
    -- 종료 상태 가드: 지원자가 취소한 건은 작성자가 되돌릴 수 없음
    IF v_app.status = 'cancelled' THEN
      RAISE EXCEPTION 'cannot_change_cancelled_application';
    END IF;
    -- 어느 한쪽이라도 완료 표시한 거래는 상태 변경 불가 (동일 상태 재호출은 no-op 허용)
    IF (v_app.hiring_completed_at IS NOT NULL OR v_app.applicant_completed_at IS NOT NULL)
       AND p_status <> v_app.status THEN
      RAISE EXCEPTION 'cannot_change_completed_deal';
    END IF;
  ELSIF v_caller = v_app.applicant_id THEN
    IF p_status <> 'cancelled' THEN
      RAISE EXCEPTION 'status_not_allowed_for_applicant';
    END IF;
    IF v_app.status NOT IN ('pending', 'reviewing') THEN
      RAISE EXCEPTION 'cannot_cancel_final_status';
    END IF;
  ELSE
    RAISE EXCEPTION 'not_party_to_application';
  END IF;

  UPDATE marie_wedding.applications
  SET status = p_status
  WHERE id = p_application_id
  RETURNING * INTO v_app;

  RETURN v_app;
END;
$function$;

-- ── #45: purge_profile_cascade 권한 가드 ────────────────────────────
-- 문제: SECURITY DEFINER + PUBLIC EXECUTE 인데 caller 검증이 없어 임의 회원 파괴 가능(IDOR/권한상승).
-- 해결: 함수 본문 최상단에 admin-또는-본인 가드. SECURITY DEFINER 내부 current_user 는
--       함수 소유자로 평가되므로 is_admin()/본인 프로필 매칭으로 판정해야 안전.
--       (authenticated EXECUTE 는 유지 — admin 삭제 버튼이 authenticated 클라이언트로 호출)
CREATE OR REPLACE FUNCTION marie_wedding.purge_profile_cascade(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_now timestamptz := NOW();
BEGIN
  -- 권한 가드: 관리자이거나, auth.uid() 가 이 프로필의 소유자일 때만 허용.
  -- auth.uid() 가 NULL(service_role/서버 컨텍스트, JWT 없음)이면 서버 신뢰 경로로 간주해 통과.
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

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;

-- ── #29: 통합검색 ILIKE 풀스캔 대상 컬럼 GIN trgm 인덱스 ─────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm
  ON marie_wedding.jobs USING gin (title gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_description_trgm
  ON marie_wedding.jobs USING gin (description gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
  ON marie_wedding.posts USING gin (title gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm
  ON marie_wedding.posts USING gin (content gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_company_trgm
  ON marie_wedding.profiles USING gin (company_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_bio_trgm
  ON marie_wedding.profiles USING gin (bio gin_trgm_ops) WHERE deleted_at IS NULL;

-- ── #43: 지원 상태변경 알림 대상 보정 ───────────────────────────────
-- 문제: 상태 변경 시 무조건 지원자에게만 알림 → 지원자 본인이 취소하면
--       자기 자신에게 알림이 가고 공고 작성자는 취소 사실을 통지받지 못함.
-- 해결: cancelled(지원자 발신)면 공고 작성자에게, 그 외(작성자 발신: reviewing/accepted/rejected)면
--       지원자에게 알림. NEW.status 분기(set_application_status 가 cancelled=지원자-only 를 보장).
CREATE OR REPLACE FUNCTION marie_wedding.notify_application_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_job_title TEXT;
  v_job_author UUID;
  v_status_label TEXT;
  v_recipient UUID;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT title, author_id INTO v_job_title, v_job_author
  FROM marie_wedding.jobs WHERE id = NEW.job_id;

  v_status_label := CASE NEW.status
    WHEN 'reviewing' THEN '검토 중'
    WHEN 'accepted' THEN '승인'
    WHEN 'rejected' THEN '거절'
    WHEN 'cancelled' THEN '취소'
    ELSE '접수'
  END;

  IF NEW.status = 'cancelled' THEN
    -- 지원자가 취소 → 공고 작성자에게 통지
    v_recipient := v_job_author;
    v_title := '지원이 취소되었습니다';
    v_message := '"' || COALESCE(v_job_title, '공고') || '" 공고의 지원이 취소되었습니다.';
  ELSE
    -- 작성자가 상태 변경 → 지원자에게 통지
    v_recipient := NEW.applicant_id;
    v_title := '지원/문의 상태가 변경되었습니다';
    v_message := '"' || COALESCE(v_job_title, '공고') || '" 상태가 ' || v_status_label || '(으)로 변경되었습니다.';
  END IF;

  -- 수신자가 없거나(공고 삭제 등) 자기 자신에게 보내는 경우는 생략
  IF v_recipient IS NOT NULL THEN
    INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
    VALUES (v_recipient, 'application_status', v_title, v_message, '/jobs/' || NEW.job_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- ── #33 백필: date-only(UTC 자정) 마감일을 KST 당일 23:59:59 로 보정 ──
UPDATE marie_wedding.jobs
   SET deadline = ((deadline AT TIME ZONE 'UTC')::date::text || ' 23:59:59+09')::timestamptz
 WHERE deadline IS NOT NULL
   AND deadline = date_trunc('day', deadline AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
