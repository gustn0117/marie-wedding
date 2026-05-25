-- 수익화 준비: 공고 프로모션 + 프로필 등급 컬럼만 우선 추가
-- 작성일: 2026-05-25

ALTER TABLE marie_wedding.jobs
  ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_promoted
  ON marie_wedding.jobs(is_promoted DESC, promoted_until DESC)
  WHERE deleted_at IS NULL AND hidden_by_admin = FALSE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_premium_tier_check'
  ) THEN
    EXECUTE $POL$
      ALTER TABLE marie_wedding.profiles
        ADD COLUMN IF NOT EXISTS premium_tier TEXT DEFAULT 'free' NOT NULL
    $POL$;
    EXECUTE $POL$
      ALTER TABLE marie_wedding.profiles
        ADD CONSTRAINT profiles_premium_tier_check CHECK (premium_tier IN ('free', 'basic', 'pro'))
    $POL$;
  END IF;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

ALTER TABLE marie_wedding.profiles
  ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
