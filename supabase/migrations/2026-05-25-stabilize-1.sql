-- 안정화 1차: 메시지 RPC, 가용 일정 컬럼 보호, 리뷰 태그 방향 검증, 조회수 dedup
-- 작성일: 2026-05-25

-- 1) 메시지 읽음 처리 RPC (클라이언트 update 의존 제거)
CREATE OR REPLACE FUNCTION marie_wedding.mark_messages_read(p_conversation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_count INTEGER;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM marie_wedding.conversations
    WHERE id = p_conversation_id
      AND (participant_a = v_caller OR participant_b = v_caller)
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  UPDATE marie_wedding.messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND sender_id <> v_caller
    AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- messages 클라이언트 직접 UPDATE 정책 제거 (RPC만 허용)
DROP POLICY IF EXISTS messages_update_read ON marie_wedding.messages;

-- 2) 가용 일정 공개 정책 분리 — note는 본인만, status/date는 누구나
DROP POLICY IF EXISTS availability_select_all ON marie_wedding.availability_slots;

CREATE OR REPLACE FUNCTION marie_wedding.get_public_availability(
  p_profile_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  date DATE,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  SELECT id, profile_id, date, status
  FROM marie_wedding.availability_slots
  WHERE profile_id = p_profile_id
    AND date >= p_from
    AND date <= p_to
  ORDER BY date ASC;
$$;

-- 본인은 직접 SELECT 가능 (note 포함)
DROP POLICY IF EXISTS availability_select_own ON marie_wedding.availability_slots;
CREATE POLICY availability_select_own ON marie_wedding.availability_slots
  FOR SELECT USING (
    profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  );

-- 3) submit_review에 태그 방향 검증 강화
CREATE OR REPLACE FUNCTION marie_wedding.submit_review(
  p_application_id UUID,
  p_tag_ids UUID[]
)
RETURNS marie_wedding.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_app marie_wedding.applications%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
  v_caller_profile UUID;
  v_direction marie_wedding.review_direction;
  v_reviewee_id UUID;
  v_target_side TEXT;
  v_review marie_wedding.reviews%ROWTYPE;
  v_completed_at TIMESTAMPTZ;
  v_invalid_count INTEGER;
BEGIN
  SELECT id INTO v_caller_profile
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller_profile IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF array_length(p_tag_ids, 1) IS NULL OR array_length(p_tag_ids, 1) > 5 THEN
    RAISE EXCEPTION 'invalid_tag_count';
  END IF;

  SELECT * INTO v_app FROM marie_wedding.applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;

  SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = v_app.job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;

  IF v_app.hiring_completed_at IS NULL OR v_app.applicant_completed_at IS NULL THEN
    RAISE EXCEPTION 'deal_not_completed';
  END IF;

  v_completed_at := GREATEST(v_app.hiring_completed_at, v_app.applicant_completed_at);
  IF NOW() > v_completed_at + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'review_window_closed';
  END IF;

  IF v_caller_profile = v_job.author_id THEN
    v_direction := 'hiring_to_applicant';
    v_reviewee_id := v_app.applicant_id;
    v_target_side := 'applicant';
  ELSIF v_caller_profile = v_app.applicant_id THEN
    v_direction := 'applicant_to_hiring';
    v_reviewee_id := v_job.author_id;
    v_target_side := 'hiring';
  ELSE
    RAISE EXCEPTION 'not_party_to_application';
  END IF;

  -- 태그 유효성 + 방향 검증
  SELECT COUNT(*) INTO v_invalid_count
  FROM unnest(p_tag_ids) AS tag_id
  WHERE NOT EXISTS (
    SELECT 1 FROM marie_wedding.review_tags rt
    WHERE rt.id = tag_id
      AND rt.is_active = TRUE
      AND v_target_side = ANY(rt.applies_to)
  );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'invalid_tag_for_direction';
  END IF;

  INSERT INTO marie_wedding.reviews(application_id, reviewer_id, reviewee_id, direction, tags)
  VALUES (p_application_id, v_caller_profile, v_reviewee_id, v_direction, p_tag_ids)
  RETURNING * INTO v_review;

  INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
  VALUES (v_reviewee_id, 'review_received', '새 리뷰가 등록되었습니다',
    '"' || v_job.title || '" 거래에 대한 리뷰가 작성되었습니다.',
    '/directory/' || v_reviewee_id);

  RETURN v_review;
END;
$$;

-- 4) 조회수 dedupe RPC + dedup 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.job_view_dedup (
  job_id UUID NOT NULL REFERENCES marie_wedding.jobs(id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (job_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_job_view_dedup_viewed_at
  ON marie_wedding.job_view_dedup(viewed_at);

CREATE OR REPLACE FUNCTION marie_wedding.increment_job_view_count(
  p_job_id UUID,
  p_viewer_key TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_existed BOOLEAN := FALSE;
BEGIN
  IF p_viewer_key IS NULL OR length(p_viewer_key) < 8 THEN
    -- 키 없으면 무시 (봇 또는 잘못된 호출)
    RETURN;
  END IF;

  -- 24시간 이내 같은 viewer가 본 적이 있으면 skip
  SELECT EXISTS(
    SELECT 1 FROM marie_wedding.job_view_dedup
    WHERE job_id = p_job_id AND viewer_key = p_viewer_key
      AND viewed_at > NOW() - INTERVAL '24 hours'
  ) INTO v_existed;

  IF NOT v_existed THEN
    INSERT INTO marie_wedding.job_view_dedup(job_id, viewer_key)
    VALUES (p_job_id, p_viewer_key)
    ON CONFLICT (job_id, viewer_key) DO UPDATE SET viewed_at = NOW();

    UPDATE marie_wedding.jobs SET view_count = view_count + 1 WHERE id = p_job_id;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
