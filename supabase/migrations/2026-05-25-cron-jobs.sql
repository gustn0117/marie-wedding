-- 주기적 실행용 RPC (외부 cron 또는 pg_cron으로 호출)
-- 작성일: 2026-05-25

-- 거래 완료 7일 경과 후 리뷰 미작성자에게 리마인드 알림
CREATE OR REPLACE FUNCTION marie_wedding.process_review_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT a.id, a.applicant_id, a.job_id, j.title, j.author_id
    FROM marie_wedding.applications a
    JOIN marie_wedding.jobs j ON j.id = a.job_id
    WHERE a.deleted_at IS NULL
      AND a.hiring_completed_at IS NOT NULL
      AND a.applicant_completed_at IS NOT NULL
      AND GREATEST(a.hiring_completed_at, a.applicant_completed_at) < NOW() - INTERVAL '7 days'
      AND GREATEST(a.hiring_completed_at, a.applicant_completed_at) > NOW() - INTERVAL '30 days'
  LOOP
    -- hiring 측 (공고 작성자) 리뷰 안 썼으면
    IF NOT EXISTS (
      SELECT 1 FROM marie_wedding.reviews
      WHERE application_id = r.id AND reviewer_id = r.author_id AND deleted_at IS NULL
    ) AND NOT EXISTS (
      SELECT 1 FROM marie_wedding.notifications
      WHERE profile_id = r.author_id AND type = 'review_reminder'
        AND link_url = '/applications/' || r.id || '/review'
        AND created_at > NOW() - INTERVAL '14 days'
    ) THEN
      INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
      VALUES (r.author_id, 'review_reminder', '리뷰 작성 기한이 다가옵니다',
        '"' || r.title || '" 거래 리뷰 작성을 잊지 마세요. 작성 가능 기간은 거래 완료 후 30일입니다.',
        '/applications/' || r.id || '/review');
      v_count := v_count + 1;
    END IF;

    -- applicant 측 (지원자) 리뷰 안 썼으면
    IF NOT EXISTS (
      SELECT 1 FROM marie_wedding.reviews
      WHERE application_id = r.id AND reviewer_id = r.applicant_id AND deleted_at IS NULL
    ) AND NOT EXISTS (
      SELECT 1 FROM marie_wedding.notifications
      WHERE profile_id = r.applicant_id AND type = 'review_reminder'
        AND link_url = '/applications/' || r.id || '/review'
        AND created_at > NOW() - INTERVAL '14 days'
    ) THEN
      INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
      VALUES (r.applicant_id, 'review_reminder', '리뷰 작성 기한이 다가옵니다',
        '"' || r.title || '" 거래 리뷰 작성을 잊지 마세요. 작성 가능 기간은 거래 완료 후 30일입니다.',
        '/applications/' || r.id || '/review');
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 30일 이상 지난 조회수 dedup 행 정리
CREATE OR REPLACE FUNCTION marie_wedding.cleanup_job_view_dedup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM marie_wedding.job_view_dedup
  WHERE viewed_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- OTP 만료 행 정리 (24시간 이상)
CREATE OR REPLACE FUNCTION marie_wedding.cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM marie_wedding.phone_otps
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- 사용법 (pg_cron 사용 시):
--   SELECT cron.schedule('review-reminders', '0 9 * * *', $$ SELECT marie_wedding.process_review_reminders(); $$);
--   SELECT cron.schedule('cleanup-view-dedup', '0 4 * * *', $$ SELECT marie_wedding.cleanup_job_view_dedup(); $$);
--   SELECT cron.schedule('cleanup-otps', '0 */6 * * *', $$ SELECT marie_wedding.cleanup_expired_otps(); $$);
-- 외부 cron 사용 시 PostgREST RPC 엔드포인트로 호출 가능.
