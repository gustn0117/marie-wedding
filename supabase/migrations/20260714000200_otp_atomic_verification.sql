-- OTP 검증/소비를 한 트랜잭션의 row lock 안에서 처리한다.
-- API의 read -> compare -> update 흐름은 동시 요청으로 attempts 제한을 우회할 수 있다.

BEGIN;

CREATE TABLE IF NOT EXISTS marie_wedding.email_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT DEFAULT 'signup' NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 초기 phone_otps 정의는 profile_id가 NOT NULL이었지만 회원가입 전 OTP도 저장한다.
ALTER TABLE marie_wedding.phone_otps
  ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE marie_wedding.phone_otps
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ;

ALTER TABLE marie_wedding.email_otps
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'signup',
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ;

ALTER TABLE marie_wedding.email_otps
  ALTER COLUMN profile_id DROP NOT NULL;

UPDATE marie_wedding.email_otps
SET purpose = 'signup'
WHERE purpose IS NULL;

ALTER TABLE marie_wedding.email_otps
  ALTER COLUMN purpose SET DEFAULT 'signup',
  ALTER COLUMN purpose SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_latest
  ON marie_wedding.phone_otps(phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose_latest
  ON marie_wedding.email_otps(email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_otps_expires_at
  ON marie_wedding.phone_otps(expires_at);

CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at
  ON marie_wedding.email_otps(expires_at);

ALTER TABLE marie_wedding.email_otps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE marie_wedding.phone_otps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE marie_wedding.email_otps FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marie_wedding.phone_otps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marie_wedding.email_otps TO service_role;

-- 존재하지 않는 식별자에는 FOR UPDATE로 잠글 행이 없으므로 advisory transaction
-- lock을 함께 사용한다. 동일 번호/이메일의 cooldown 확인과 INSERT가 직렬화된다.
CREATE OR REPLACE FUNCTION marie_wedding.issue_phone_otp_atomic(
  p_otp_id UUID,
  p_profile_id UUID,
  p_phone TEXT,
  p_code_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_cooldown_seconds INTEGER DEFAULT 30
)
RETURNS TABLE(otp_id UUID, issuance_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_recent_created_at TIMESTAMPTZ;
  v_cooldown_seconds INTEGER := LEAST(GREATEST(COALESCE(p_cooldown_seconds, 30), 0), 3600);
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marie:phone-otp:' || COALESCE(p_phone, ''), 0)
  );

  SELECT candidate.created_at
  INTO v_recent_created_at
  FROM marie_wedding.phone_otps AS candidate
  WHERE candidate.phone = p_phone
  ORDER BY candidate.created_at DESC
  LIMIT 1;

  IF v_recent_created_at IS NOT NULL
     AND v_recent_created_at > clock_timestamp() - (v_cooldown_seconds * INTERVAL '1 second') THEN
    RETURN QUERY SELECT NULL::UUID, 'cooldown'::TEXT;
    RETURN;
  END IF;

  INSERT INTO marie_wedding.phone_otps (
    id, profile_id, phone, code_hash, attempts, expires_at
  ) VALUES (
    p_otp_id, p_profile_id, p_phone, p_code_hash, 0, p_expires_at
  );

  RETURN QUERY SELECT p_otp_id, 'created'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.issue_email_otp_atomic(
  p_otp_id UUID,
  p_profile_id UUID,
  p_email TEXT,
  p_purpose TEXT,
  p_code_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_cooldown_seconds INTEGER DEFAULT 30
)
RETURNS TABLE(otp_id UUID, issuance_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_recent_created_at TIMESTAMPTZ;
  v_cooldown_seconds INTEGER := LEAST(GREATEST(COALESCE(p_cooldown_seconds, 30), 0), 3600);
BEGIN
  IF p_purpose IS NULL OR p_purpose NOT IN ('signup', 'reset') THEN
    RETURN QUERY SELECT NULL::UUID, 'invalid_purpose'::TEXT;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'marie:email-otp:' || p_purpose || ':' || COALESCE(p_email, ''),
      0
    )
  );

  SELECT candidate.created_at
  INTO v_recent_created_at
  FROM marie_wedding.email_otps AS candidate
  WHERE candidate.email = p_email
    AND candidate.purpose = p_purpose
  ORDER BY candidate.created_at DESC
  LIMIT 1;

  IF v_recent_created_at IS NOT NULL
     AND v_recent_created_at > clock_timestamp() - (v_cooldown_seconds * INTERVAL '1 second') THEN
    RETURN QUERY SELECT NULL::UUID, 'cooldown'::TEXT;
    RETURN;
  END IF;

  INSERT INTO marie_wedding.email_otps (
    id, profile_id, email, purpose, code_hash, attempts, expires_at
  ) VALUES (
    p_otp_id, p_profile_id, p_email, p_purpose, p_code_hash, 0, p_expires_at
  );

  RETURN QUERY SELECT p_otp_id, 'created'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.verify_phone_otp_atomic(
  p_phone TEXT,
  p_code_hash TEXT,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS TABLE(otp_id UUID, verification_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_otp marie_wedding.phone_otps%ROWTYPE;
  v_max_attempts INTEGER := GREATEST(COALESCE(p_max_attempts, 5), 1);
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marie:phone-otp:' || COALESCE(p_phone, ''), 0)
  );

  SELECT candidate.*
  INTO v_otp
  FROM marie_wedding.phone_otps AS candidate
  WHERE candidate.phone = p_phone
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
     OR v_otp.profile_id IS NOT NULL
     OR v_otp.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF v_otp.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT v_otp.id, 'expired'::TEXT;
    RETURN;
  END IF;

  IF v_otp.attempts >= v_max_attempts THEN
    RETURN QUERY SELECT v_otp.id, 'attempts_exceeded'::TEXT;
    RETURN;
  END IF;

  IF v_otp.code_hash IS DISTINCT FROM p_code_hash THEN
    IF v_otp.attempts >= v_max_attempts THEN
      RETURN QUERY SELECT v_otp.id, 'attempts_exceeded'::TEXT;
      RETURN;
    END IF;

    UPDATE marie_wedding.phone_otps
    SET attempts = attempts + 1
    WHERE id = v_otp.id;

    RETURN QUERY SELECT v_otp.id, 'mismatch'::TEXT;
    RETURN;
  END IF;

  IF v_otp.verified_at IS NULL THEN
    UPDATE marie_wedding.phone_otps
    SET verified_at = clock_timestamp()
    WHERE id = v_otp.id;
  END IF;

  RETURN QUERY SELECT v_otp.id, 'verified'::TEXT;
END;
$$;

-- 로그인 사용자의 번호 인증은 OTP 발급 당시 profile_id와 현재 세션에서 검증한
-- profile_id가 같아야 한다. OTP 소비와 profile 갱신을 같은 트랜잭션에서 처리해
-- 한 코드를 여러 프로필에 재사용하거나 갱신만 누락되는 간극을 없앤다.
CREATE OR REPLACE FUNCTION marie_wedding.verify_and_bind_profile_phone_otp_atomic(
  p_profile_id UUID,
  p_phone TEXT,
  p_code_hash TEXT,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS TABLE(otp_id UUID, verification_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_otp marie_wedding.phone_otps%ROWTYPE;
  v_max_attempts INTEGER := GREATEST(COALESCE(p_max_attempts, 5), 1);
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marie:phone-otp:' || COALESCE(p_phone, ''), 0)
  );

  SELECT candidate.*
  INTO v_otp
  FROM marie_wedding.phone_otps AS candidate
  WHERE candidate.phone = p_phone
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
     OR v_otp.profile_id IS DISTINCT FROM p_profile_id
     OR v_otp.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF v_otp.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT v_otp.id, 'expired'::TEXT;
    RETURN;
  END IF;

  IF v_otp.attempts >= v_max_attempts THEN
    RETURN QUERY SELECT v_otp.id, 'attempts_exceeded'::TEXT;
    RETURN;
  END IF;

  IF v_otp.code_hash IS DISTINCT FROM p_code_hash THEN
    UPDATE marie_wedding.phone_otps
    SET attempts = attempts + 1
    WHERE id = v_otp.id;

    RETURN QUERY SELECT v_otp.id, 'mismatch'::TEXT;
    RETURN;
  END IF;

  UPDATE marie_wedding.profiles
  SET phone = p_phone,
      phone_verified = TRUE,
      phone_verified_at = clock_timestamp()
  WHERE id = p_profile_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT v_otp.id, 'profile_not_found'::TEXT;
    RETURN;
  END IF;

  UPDATE marie_wedding.phone_otps
  SET verified_at = COALESCE(verified_at, clock_timestamp()),
      consumed_at = clock_timestamp(),
      claim_token = NULL,
      claim_expires_at = NULL
  WHERE id = v_otp.id;

  RETURN QUERY SELECT v_otp.id, 'verified'::TEXT;
END;
$$;

-- 회원가입은 Auth Admin API와 profile INSERT를 포함해 DB 트랜잭션 하나로
-- 묶을 수 없다. 먼저 검증 완료 OTP에 짧은 lease를 잡고, 성공 후 consume하며,
-- 중간 실패 시 release한다. 동일 OTP를 이용한 동시 회원가입은 claim row lock과
-- advisory lock으로 하나만 통과한다.
CREATE OR REPLACE FUNCTION marie_wedding.claim_signup_otp_atomic(
  p_method TEXT,
  p_identifier TEXT,
  p_claim_token UUID,
  p_verify_window_seconds INTEGER DEFAULT 1800,
  p_claim_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(otp_id UUID, claim_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_phone_otp marie_wedding.phone_otps%ROWTYPE;
  v_email_otp marie_wedding.email_otps%ROWTYPE;
  v_verify_window INTEGER := LEAST(GREATEST(COALESCE(p_verify_window_seconds, 1800), 1), 86400);
  v_claim_seconds INTEGER := LEAST(GREATEST(COALESCE(p_claim_seconds, 60), 15), 300);
BEGIN
  IF p_method NOT IN ('phone', 'email')
     OR NULLIF(p_identifier, '') IS NULL
     OR p_claim_token IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'invalid_input'::TEXT;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      CASE p_method
        WHEN 'phone' THEN 'marie:phone-otp:' || p_identifier
        ELSE 'marie:email-otp:signup:' || p_identifier
      END,
      0
    )
  );

  IF p_method = 'phone' THEN
    SELECT candidate.*
    INTO v_phone_otp
    FROM marie_wedding.phone_otps AS candidate
    WHERE candidate.phone = p_identifier
    ORDER BY candidate.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND
       OR v_phone_otp.verified_at IS NULL
       OR v_phone_otp.profile_id IS NOT NULL
       OR v_phone_otp.consumed_at IS NOT NULL THEN
      RETURN QUERY SELECT NULL::UUID, 'not_verified'::TEXT;
      RETURN;
    END IF;

    IF v_phone_otp.verified_at < clock_timestamp() - (v_verify_window * INTERVAL '1 second') THEN
      RETURN QUERY SELECT v_phone_otp.id, 'verification_expired'::TEXT;
      RETURN;
    END IF;

    IF v_phone_otp.claim_token IS NOT NULL
       AND v_phone_otp.claim_expires_at > clock_timestamp()
       AND v_phone_otp.claim_token IS DISTINCT FROM p_claim_token THEN
      RETURN QUERY SELECT v_phone_otp.id, 'in_progress'::TEXT;
      RETURN;
    END IF;

    UPDATE marie_wedding.phone_otps
    SET claim_token = p_claim_token,
        claim_expires_at = clock_timestamp() + (v_claim_seconds * INTERVAL '1 second')
    WHERE id = v_phone_otp.id;

    RETURN QUERY SELECT v_phone_otp.id, 'claimed'::TEXT;
    RETURN;
  END IF;

  SELECT candidate.*
  INTO v_email_otp
  FROM marie_wedding.email_otps AS candidate
  WHERE candidate.email = p_identifier
    AND candidate.purpose = 'signup'
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
     OR v_email_otp.verified_at IS NULL
     OR v_email_otp.profile_id IS NOT NULL
     OR v_email_otp.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'not_verified'::TEXT;
    RETURN;
  END IF;

  IF v_email_otp.verified_at < clock_timestamp() - (v_verify_window * INTERVAL '1 second') THEN
    RETURN QUERY SELECT v_email_otp.id, 'verification_expired'::TEXT;
    RETURN;
  END IF;

  IF v_email_otp.claim_token IS NOT NULL
     AND v_email_otp.claim_expires_at > clock_timestamp()
     AND v_email_otp.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN QUERY SELECT v_email_otp.id, 'in_progress'::TEXT;
    RETURN;
  END IF;

  UPDATE marie_wedding.email_otps
  SET claim_token = p_claim_token,
      claim_expires_at = clock_timestamp() + (v_claim_seconds * INTERVAL '1 second')
  WHERE id = v_email_otp.id;

  RETURN QUERY SELECT v_email_otp.id, 'claimed'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.consume_signup_otp_atomic(
  p_method TEXT,
  p_otp_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_consumed UUID;
BEGIN
  IF p_method = 'phone' THEN
    UPDATE marie_wedding.phone_otps
    SET consumed_at = COALESCE(consumed_at, clock_timestamp()),
        claim_expires_at = NULL
    WHERE id = p_otp_id
      AND verified_at IS NOT NULL
      AND claim_token = p_claim_token
    RETURNING id INTO v_consumed;
  ELSIF p_method = 'email' THEN
    UPDATE marie_wedding.email_otps
    SET consumed_at = COALESCE(consumed_at, clock_timestamp()),
        claim_expires_at = NULL
    WHERE id = p_otp_id
      AND purpose = 'signup'
      AND verified_at IS NOT NULL
      AND claim_token = p_claim_token
    RETURNING id INTO v_consumed;
  ELSE
    RETURN FALSE;
  END IF;

  -- claim_token은 감사와 네트워크 재시도의 idempotency 판정을 위해 보존한다.
  RETURN v_consumed IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.release_signup_otp_claim(
  p_method TEXT,
  p_otp_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_released UUID;
BEGIN
  IF p_method = 'phone' THEN
    UPDATE marie_wedding.phone_otps
    SET claim_token = NULL,
        claim_expires_at = NULL
    WHERE id = p_otp_id
      AND claim_token = p_claim_token
      AND consumed_at IS NULL
    RETURNING id INTO v_released;
  ELSIF p_method = 'email' THEN
    UPDATE marie_wedding.email_otps
    SET claim_token = NULL,
        claim_expires_at = NULL
    WHERE id = p_otp_id
      AND purpose = 'signup'
      AND claim_token = p_claim_token
      AND consumed_at IS NULL
    RETURNING id INTO v_released;
  ELSE
    RETURN FALSE;
  END IF;

  RETURN v_released IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.verify_email_otp_atomic(
  p_email TEXT,
  p_purpose TEXT,
  p_code_hash TEXT,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS TABLE(otp_id UUID, verification_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_otp marie_wedding.email_otps%ROWTYPE;
  v_max_attempts INTEGER := GREATEST(COALESCE(p_max_attempts, 5), 1);
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'marie:email-otp:' || COALESCE(p_purpose, '') || ':' || COALESCE(p_email, ''),
      0
    )
  );

  SELECT candidate.*
  INTO v_otp
  FROM marie_wedding.email_otps AS candidate
  WHERE candidate.email = p_email
    AND candidate.purpose = p_purpose
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_otp.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF v_otp.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT v_otp.id, 'expired'::TEXT;
    RETURN;
  END IF;

  IF v_otp.attempts >= v_max_attempts THEN
    RETURN QUERY SELECT v_otp.id, 'attempts_exceeded'::TEXT;
    RETURN;
  END IF;

  IF v_otp.code_hash IS DISTINCT FROM p_code_hash THEN
    IF v_otp.attempts >= v_max_attempts THEN
      RETURN QUERY SELECT v_otp.id, 'attempts_exceeded'::TEXT;
      RETURN;
    END IF;

    UPDATE marie_wedding.email_otps
    SET attempts = attempts + 1
    WHERE id = v_otp.id;

    RETURN QUERY SELECT v_otp.id, 'mismatch'::TEXT;
    RETURN;
  END IF;

  IF v_otp.verified_at IS NULL THEN
    UPDATE marie_wedding.email_otps
    SET verified_at = clock_timestamp()
    WHERE id = v_otp.id;
  END IF;

  RETURN QUERY SELECT v_otp.id, 'verified'::TEXT;
END;
$$;

-- Auth API 호출은 DB 트랜잭션 밖의 작업이다. OTP 만료까지의 claim lease로 동시
-- 비밀번호 변경을 직렬화하고, Auth 호출 전 실패만 claim을 해제한다.
CREATE OR REPLACE FUNCTION marie_wedding.claim_password_reset_otp_atomic(
  p_email TEXT,
  p_code_hash TEXT,
  p_max_attempts INTEGER,
  p_claim_token UUID
)
RETURNS TABLE(otp_id UUID, verification_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_otp marie_wedding.email_otps%ROWTYPE;
  v_max_attempts INTEGER := GREATEST(COALESCE(p_max_attempts, 5), 1);
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marie:email-otp:reset:' || COALESCE(p_email, ''), 0)
  );

  SELECT candidate.*
  INTO v_otp
  FROM marie_wedding.email_otps AS candidate
  WHERE candidate.email = p_email
    AND candidate.purpose = 'reset'
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR p_claim_token IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF v_otp.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF v_otp.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT v_otp.id, 'expired'::TEXT;
    RETURN;
  END IF;

  IF v_otp.attempts >= v_max_attempts THEN
    RETURN QUERY SELECT v_otp.id, 'attempts_exceeded'::TEXT;
    RETURN;
  END IF;

  IF v_otp.code_hash IS DISTINCT FROM p_code_hash THEN
    IF v_otp.attempts >= v_max_attempts THEN
      RETURN QUERY SELECT v_otp.id, 'attempts_exceeded'::TEXT;
      RETURN;
    END IF;

    UPDATE marie_wedding.email_otps
    SET attempts = attempts + 1
    WHERE id = v_otp.id;

    RETURN QUERY SELECT v_otp.id, 'mismatch'::TEXT;
    RETURN;
  END IF;

  IF v_otp.claim_token IS NOT NULL
     AND v_otp.claim_expires_at > clock_timestamp()
     AND v_otp.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN QUERY SELECT v_otp.id, 'in_progress'::TEXT;
    RETURN;
  END IF;

  UPDATE marie_wedding.email_otps
  SET verified_at = COALESCE(verified_at, clock_timestamp()),
      claim_token = p_claim_token,
      -- Auth 비밀번호 변경 성공 직후 프로세스가 끊기면 DB consume 결과를 알 수
      -- 없다. claim을 OTP 자체 만료까지 유지해 같은 코드가 다른 비밀번호 변경에
      -- 다시 쓰이지 않게 하고, Auth 호출 전 실패만 명시적으로 release한다.
      claim_expires_at = v_otp.expires_at
  WHERE id = v_otp.id;

  RETURN QUERY SELECT v_otp.id, 'claimed'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.complete_password_reset_otp_atomic(
  p_otp_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_otp marie_wedding.email_otps%ROWTYPE;
BEGIN
  SELECT candidate.*
  INTO v_otp
  FROM marie_wedding.email_otps AS candidate
  WHERE candidate.id = p_otp_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_otp.verified_at IS NULL
     OR v_otp.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN FALSE;
  END IF;

  IF v_otp.consumed_at IS NULL THEN
    UPDATE marie_wedding.email_otps
    SET consumed_at = clock_timestamp(),
        claim_expires_at = NULL
    WHERE id = v_otp.id;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.release_password_reset_otp_claim(
  p_otp_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_released UUID;
BEGIN
  UPDATE marie_wedding.email_otps
  SET claim_token = NULL,
      claim_expires_at = NULL
  WHERE id = p_otp_id
    AND claim_token = p_claim_token
    AND consumed_at IS NULL
  RETURNING id INTO v_released;

  RETURN v_released IS NOT NULL;
END;
$$;

-- 기존 cron 함수는 phone만 지워 email_otps가 무한히 쌓였다. 두 테이블의
-- 만료 후 24시간이 지난 행을 함께 정리하고 합산 건수를 반환한다.
CREATE OR REPLACE FUNCTION marie_wedding.cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_phone_count INTEGER;
  v_email_count INTEGER;
BEGIN
  DELETE FROM marie_wedding.phone_otps
  WHERE expires_at < clock_timestamp() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_phone_count = ROW_COUNT;

  DELETE FROM marie_wedding.email_otps
  WHERE expires_at < clock_timestamp() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_email_count = ROW_COUNT;

  RETURN v_phone_count + v_email_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION marie_wedding.verify_phone_otp_atomic(TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.verify_email_otp_atomic(TEXT, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.verify_and_bind_profile_phone_otp_atomic(UUID, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.claim_password_reset_otp_atomic(TEXT, TEXT, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.complete_password_reset_otp_atomic(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.release_password_reset_otp_claim(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.issue_phone_otp_atomic(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.issue_email_otp_atomic(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.claim_signup_otp_atomic(TEXT, TEXT, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.consume_signup_otp_atomic(TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.release_signup_otp_claim(TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION marie_wedding.cleanup_expired_otps()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION marie_wedding.verify_phone_otp_atomic(TEXT, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.verify_email_otp_atomic(TEXT, TEXT, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.verify_and_bind_profile_phone_otp_atomic(UUID, TEXT, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.claim_password_reset_otp_atomic(TEXT, TEXT, INTEGER, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.complete_password_reset_otp_atomic(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.release_password_reset_otp_claim(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.issue_phone_otp_atomic(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.issue_email_otp_atomic(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.claim_signup_otp_atomic(TEXT, TEXT, UUID, INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.consume_signup_otp_atomic(TEXT, UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.release_signup_otp_claim(TEXT, UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.cleanup_expired_otps()
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
