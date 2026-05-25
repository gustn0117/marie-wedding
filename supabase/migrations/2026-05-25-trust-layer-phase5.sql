-- 신뢰 레이어 Phase 5: 개인 휴대폰 본인인증 (OTP 저장 테이블)
-- 작성일: 2026-05-25

CREATE TABLE IF NOT EXISTS marie_wedding.phone_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_profile_pending
  ON marie_wedding.phone_otps(profile_id, created_at DESC)
  WHERE verified_at IS NULL;

-- RLS는 service_role API에서만 접근하므로 켜고 모든 정책은 service_role 통과
ALTER TABLE marie_wedding.phone_otps ENABLE ROW LEVEL SECURITY;

-- 사용자가 직접 query 불가. service_role만 접근.
NOTIFY pgrst, 'reload schema';
