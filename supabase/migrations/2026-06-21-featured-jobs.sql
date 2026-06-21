-- 인기 공고 (Featured Jobs) — 관리자가 메인 페이지에 노출할 공고를 선정
-- 2026-06-21

ALTER TABLE marie_wedding.jobs
  ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_order INT;

CREATE INDEX IF NOT EXISTS jobs_featured_idx
  ON marie_wedding.jobs(featured_order, featured_at DESC)
  WHERE featured_at IS NOT NULL AND deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
