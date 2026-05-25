-- 플랫폼 강화 2차: 자동 모더레이션 + 저장 검색
-- 작성일: 2026-05-25

-- 1) jobs.hidden_by_admin
ALTER TABLE marie_wedding.jobs
  ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- 신고 3건(고유 reporter) 이상 누적 시 자동 hide
CREATE OR REPLACE FUNCTION marie_wedding.auto_hide_job_on_reports()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NEW.target_type = 'job' THEN
    SELECT COUNT(DISTINCT reporter_id) INTO v_count
    FROM marie_wedding.reports
    WHERE target_type = 'job' AND target_id = NEW.target_id AND status IN ('open', 'reviewing');
    IF v_count >= 3 THEN
      UPDATE marie_wedding.jobs SET hidden_by_admin = TRUE WHERE id = NEW.target_id AND hidden_by_admin = FALSE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS reports_auto_hide_job ON marie_wedding.reports;
CREATE TRIGGER reports_auto_hide_job
  AFTER INSERT ON marie_wedding.reports
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.auto_hide_job_on_reports();

-- 2) saved_searches 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('jobs', 'directory')),
  query JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_profile ON marie_wedding.saved_searches(profile_id, created_at DESC);

ALTER TABLE marie_wedding.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_searches_select_own ON marie_wedding.saved_searches;
CREATE POLICY saved_searches_select_own ON marie_wedding.saved_searches
  FOR SELECT USING (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));

DROP POLICY IF EXISTS saved_searches_insert_own ON marie_wedding.saved_searches;
CREATE POLICY saved_searches_insert_own ON marie_wedding.saved_searches
  FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));

DROP POLICY IF EXISTS saved_searches_delete_own ON marie_wedding.saved_searches;
CREATE POLICY saved_searches_delete_own ON marie_wedding.saved_searches
  FOR DELETE USING (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));

NOTIFY pgrst, 'reload schema';
