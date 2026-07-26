-- 대행 등록 공고 — 업체 동의를 받아 관리자가 대신 올리는 공고.
-- 주인이 없는 상태로 존재하므로 author_id 의 NOT NULL 을 해제한다(가짜 계정을 만들지 않기 위함).
-- 업체가 가입 후 claim_code 를 입력하면 author_id 가 채워지고 claimed_at 이 찍힌다.
ALTER TABLE marie_wedding.jobs ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE marie_wedding.jobs
  ADD COLUMN IF NOT EXISTS proxy_company_name text,   -- 표시용 업체명
  ADD COLUMN IF NOT EXISTS proxy_contact text,        -- 업체 연락처(관리자용)
  ADD COLUMN IF NOT EXISTS proxy_consent_note text,   -- 동의를 받은 경위(법적 근거)
  ADD COLUMN IF NOT EXISTS proxy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_code text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_claim_code_key
  ON marie_wedding.jobs (claim_code) WHERE claim_code IS NOT NULL;
