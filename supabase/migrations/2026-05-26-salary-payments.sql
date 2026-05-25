-- 공고 급여 범위·경력 컬럼 + 결제 placeholder 테이블
-- 작성일: 2026-05-26

-- 1) jobs 급여 범위 + 최소 경력 (만원·년 단위)
ALTER TABLE marie_wedding.jobs
  ADD COLUMN IF NOT EXISTS salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS salary_unit TEXT DEFAULT 'monthly' NOT NULL,
  ADD COLUMN IF NOT EXISTS experience_min INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_salary_unit_check') THEN
    EXECUTE 'ALTER TABLE marie_wedding.jobs ADD CONSTRAINT jobs_salary_unit_check CHECK (salary_unit IN (''monthly'', ''yearly'', ''daily'', ''hourly''))';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_salary_range
  ON marie_wedding.jobs(salary_min, salary_max)
  WHERE deleted_at IS NULL AND hidden_by_admin = FALSE;

-- 2) payments placeholder (실제 결제 게이트웨이 연동 전 인터페이스)
CREATE TABLE IF NOT EXISTS marie_wedding.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'KRW' NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('job_promotion', 'premium_tier', 'event_listing', 'directory_boost')),
  product_id UUID,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'refunded', 'failed', 'cancelled')),
  gateway TEXT,
  gateway_transaction_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_profile ON marie_wedding.payments(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON marie_wedding.payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_product ON marie_wedding.payments(product_type, product_id);

ALTER TABLE marie_wedding.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_own ON marie_wedding.payments;
CREATE POLICY payments_select_own ON marie_wedding.payments
  FOR SELECT USING (
    marie_wedding.is_admin()
    OR profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS payments_admin_all ON marie_wedding.payments;
CREATE POLICY payments_admin_all ON marie_wedding.payments
  FOR ALL USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

-- 3) 프로모션 만료 자동 처리 cron RPC
CREATE OR REPLACE FUNCTION marie_wedding.expire_promotions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_jobs INTEGER;
  v_profiles INTEGER;
BEGIN
  UPDATE marie_wedding.jobs
  SET is_promoted = FALSE
  WHERE is_promoted = TRUE
    AND promoted_until IS NOT NULL
    AND promoted_until < NOW();
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  UPDATE marie_wedding.profiles
  SET premium_tier = 'free'
  WHERE premium_tier <> 'free'
    AND premium_until IS NOT NULL
    AND premium_until < NOW();
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  RETURN v_jobs + v_profiles;
END;
$$;

NOTIFY pgrst, 'reload schema';
