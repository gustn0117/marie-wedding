-- 플랫폼 강화 1차: 응답 metrics 자동 계산 + jobs 조회수 + 풀텍스트 검색 인덱스
-- 작성일: 2026-05-25

-- 1) jobs.view_count 컬럼 추가
ALTER TABLE marie_wedding.jobs
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;

-- 2) jobs 조회수 증가 RPC
CREATE OR REPLACE FUNCTION marie_wedding.increment_job_view_count(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
BEGIN
  UPDATE marie_wedding.jobs SET view_count = view_count + 1 WHERE id = p_job_id;
END;
$$;

-- 3) 응답 metrics 자동 계산 함수
CREATE OR REPLACE FUNCTION marie_wedding.recalc_response_metrics(p_author_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_total INTEGER;
  v_responded INTEGER;
  v_avg_min INTEGER;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE a.first_responded_at IS NOT NULL),
         NULLIF(AVG(EXTRACT(EPOCH FROM (a.first_responded_at - a.created_at)) / 60), 'NaN')::INTEGER
    INTO v_total, v_responded, v_avg_min
  FROM marie_wedding.applications a
  JOIN marie_wedding.jobs j ON j.id = a.job_id
  WHERE j.author_id = p_author_id
    AND a.deleted_at IS NULL;

  UPDATE marie_wedding.profiles
  SET response_rate = CASE WHEN v_total > 0 THEN ROUND((v_responded::NUMERIC / v_total) * 100, 2) ELSE 0 END,
      avg_response_minutes = v_avg_min
  WHERE id = p_author_id;
END;
$$;

-- 4) 트리거: applications 변동 시 author metrics 재계산
CREATE OR REPLACE FUNCTION marie_wedding.trigger_recalc_response()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
  v_job_id UUID;
BEGIN
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  SELECT author_id INTO v_author_id FROM marie_wedding.jobs WHERE id = v_job_id;
  IF v_author_id IS NOT NULL THEN
    PERFORM marie_wedding.recalc_response_metrics(v_author_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS applications_recalc_response ON marie_wedding.applications;
CREATE TRIGGER applications_recalc_response
  AFTER INSERT OR UPDATE OF status, first_responded_at, deleted_at ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.trigger_recalc_response();

-- 5) 풀텍스트 검색을 위한 pg_trgm 인덱스
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm
  ON marie_wedding.jobs USING gin (title gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_company_name_trgm
  ON marie_wedding.profiles USING gin (company_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
  ON marie_wedding.posts USING gin (title gin_trgm_ops) WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
