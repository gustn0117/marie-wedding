-- 지원자(applicant) account_type = 'individual' 강제
-- 업체 회원은 다른 공고에 지원할 수 없도록 INSERT 정책 강화
-- (기존 applications_insert_own 폴리시 교체)

DROP POLICY IF EXISTS applications_insert_own ON marie_wedding.applications;

CREATE POLICY applications_insert_own ON marie_wedding.applications FOR INSERT WITH CHECK (
  applicant_id IN (
    SELECT id FROM marie_wedding.profiles
    WHERE user_id = auth.uid()
      AND deleted_at IS NULL
      AND account_type = 'individual'
  )
  AND job_id NOT IN (
    SELECT id FROM marie_wedding.jobs
    WHERE author_id IN (
      SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY applications_insert_own ON marie_wedding.applications IS
  '개인 회원(account_type=individual)만 본인 명의로 지원 INSERT 가능. 업체 회원/계정유형 미설정은 차단.';
