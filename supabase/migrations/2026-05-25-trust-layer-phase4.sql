-- 신뢰 레이어 Phase 4: 리뷰 RPC + reports.target_type에 'review' 추가
-- 작성일: 2026-05-25

-- reports.target_type에 'review' 허용
ALTER TABLE marie_wedding.reports
  DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE marie_wedding.reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('job', 'profile', 'post', 'comment', 'event', 'review'));

-- 리뷰 제출 RPC
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
  v_review marie_wedding.reviews%ROWTYPE;
  v_completed_at TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_caller_profile
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller_profile IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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
  ELSIF v_caller_profile = v_app.applicant_id THEN
    v_direction := 'applicant_to_hiring';
    v_reviewee_id := v_job.author_id;
  ELSE
    RAISE EXCEPTION 'not_party_to_application';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_tag_ids) AS tag_id
    WHERE tag_id NOT IN (SELECT id FROM marie_wedding.review_tags WHERE is_active = TRUE)
  ) THEN
    RAISE EXCEPTION 'invalid_tag';
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

NOTIFY pgrst, 'reload schema';
