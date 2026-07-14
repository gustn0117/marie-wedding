-- 결제 금액/혜택은 서버 카탈로그만 결정하고, 브라우저의 직접 쓰기는 금지한다.

BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE marie_wedding.payments FROM PUBLIC, anon, authenticated;

-- 이 마이그레이션 전에 만들어진 premium pending 행에는 sku가 없을 수 있다.
-- 공식 가격은 각 SKU와 1:1 대응하므로 정확히 일치하는 행만 백필한다. 가격을
-- 카탈로그로 안전하게 환원할 수 없는 행은 이후 webhook에서 trigger 오류를
-- 반복하지 않도록 선제적으로 실패 처리한다.
UPDATE marie_wedding.payments
SET metadata = COALESCE(metadata, '{}'::JSONB)
  || jsonb_build_object(
    'sku', CASE amount
      WHEN 29000 THEN 'premium_basic_monthly'
      WHEN 290000 THEN 'premium_basic_yearly'
      WHEN 79000 THEN 'premium_pro_monthly'
      WHEN 790000 THEN 'premium_pro_yearly'
    END,
    'tier', CASE amount
      WHEN 29000 THEN 'basic'
      WHEN 290000 THEN 'basic'
      WHEN 79000 THEN 'pro'
      WHEN 790000 THEN 'pro'
    END
  )
WHERE status = 'pending'
  AND product_type = 'premium_tier'
  AND amount IN (29000, 290000, 79000, 790000)
  AND COALESCE(metadata->>'sku', '') NOT IN (
    'premium_basic_monthly',
    'premium_basic_yearly',
    'premium_pro_monthly',
    'premium_pro_yearly'
  );

UPDATE marie_wedding.payments
SET status = 'failed',
    metadata = COALESCE(metadata, '{}'::JSONB)
      || jsonb_build_object('failure_reason', 'legacy_payment_catalog_mismatch')
WHERE status = 'pending'
  AND product_type = 'premium_tier'
  AND (
    (metadata->>'sku', amount, metadata->>'tier') NOT IN (
      ('premium_basic_monthly', 29000, 'basic'),
      ('premium_basic_yearly', 290000, 'basic'),
      ('premium_pro_monthly', 79000, 'pro'),
      ('premium_pro_yearly', 790000, 'pro')
    )
    OR metadata->>'sku' IS NULL
    OR metadata->>'tier' IS NULL
  );

-- 상태 전이는 UPDATE의 WHERE 절에서 원자적으로 판정한다. 과거 구현처럼
-- SELECT 후 UPDATE하면 webhook 완료와 사전등록 실패가 경합할 때 terminal
-- 상태가 서로 덮일 수 있다.
CREATE OR REPLACE FUNCTION marie_wedding.mark_payment_completed(
  p_payment_id UUID,
  p_gateway_transaction_id TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS marie_wedding.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_payment marie_wedding.payments%ROWTYPE;
BEGIN
  UPDATE marie_wedding.payments
  SET status = 'completed',
      gateway_transaction_id = p_gateway_transaction_id,
      completed_at = clock_timestamp(),
      metadata = COALESCE(metadata, '{}'::JSONB) || COALESCE(p_metadata, '{}'::JSONB)
  WHERE id = p_payment_id
    AND status = 'pending'
  RETURNING * INTO v_payment;

  IF FOUND THEN
    RETURN v_payment;
  END IF;

  SELECT * INTO v_payment
  FROM marie_wedding.payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;
  IF v_payment.status = 'completed' THEN
    RETURN v_payment;
  END IF;

  RAISE EXCEPTION 'invalid_status_for_complete_%', v_payment.status;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.mark_payment_failed(
  p_payment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS marie_wedding.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_payment marie_wedding.payments%ROWTYPE;
BEGIN
  UPDATE marie_wedding.payments
  SET status = 'failed',
      metadata = COALESCE(metadata, '{}'::JSONB)
        || jsonb_build_object('failure_reason', p_reason)
  WHERE id = p_payment_id
    AND status = 'pending'
  RETURNING * INTO v_payment;

  IF FOUND THEN
    RETURN v_payment;
  END IF;

  SELECT * INTO v_payment
  FROM marie_wedding.payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;

  -- completed/refunded/failed/cancelled는 모두 terminal이다. 재시도는 성공으로
  -- 취급하되 상태를 절대 변경하지 않는다.
  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.handle_payment_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, marie_wedding
AS $$
DECLARE
  v_sku TEXT;
  v_expected_amount INTEGER;
  v_new_tier TEXT;
  v_duration INTERVAL;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    IF NEW.product_type = 'premium_tier' THEN
      v_sku := NEW.metadata->>'sku';
      CASE v_sku
        WHEN 'premium_basic_monthly' THEN
          v_expected_amount := 29000; v_new_tier := 'basic'; v_duration := INTERVAL '30 days';
        WHEN 'premium_basic_yearly' THEN
          v_expected_amount := 290000; v_new_tier := 'basic'; v_duration := INTERVAL '365 days';
        WHEN 'premium_pro_monthly' THEN
          v_expected_amount := 79000; v_new_tier := 'pro'; v_duration := INTERVAL '30 days';
        WHEN 'premium_pro_yearly' THEN
          v_expected_amount := 790000; v_new_tier := 'pro'; v_duration := INTERVAL '365 days';
        ELSE
          RAISE EXCEPTION 'invalid_payment_sku';
      END CASE;

      IF NEW.amount <> v_expected_amount
         OR NEW.metadata->>'tier' <> v_new_tier THEN
        RAISE EXCEPTION 'payment_catalog_mismatch';
      END IF;

      UPDATE marie_wedding.profiles
      SET premium_tier = v_new_tier,
          premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + v_duration
      WHERE id = NEW.profile_id;

    ELSIF NEW.product_type = 'job_promotion' AND NEW.product_id IS NOT NULL THEN
      UPDATE marie_wedding.jobs
      SET is_promoted = TRUE,
          promoted_until = GREATEST(COALESCE(promoted_until, NOW()), NOW()) + INTERVAL '30 days'
      WHERE id = NEW.product_id AND author_id = NEW.profile_id;

      IF NOT FOUND THEN RAISE EXCEPTION 'invalid_promotion_target'; END IF;
    END IF;

    INSERT INTO marie_wedding.notifications (profile_id, type, title, message, link_url)
    VALUES (
      NEW.profile_id,
      'payment',
      '결제 완료',
      CASE NEW.product_type
        WHEN 'premium_tier' THEN '프리미엄 등급으로 업그레이드되었습니다.'
        WHEN 'job_promotion' THEN '공고 추천 노출이 활성화되었습니다.'
        WHEN 'event_listing' THEN '이벤트 등록이 완료되었습니다.'
        WHEN 'directory_boost' THEN '디렉토리 부스트가 활성화되었습니다.'
        ELSE '결제가 완료되었습니다.'
      END,
      '/mypage/payments'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION marie_wedding.handle_payment_completion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marie_wedding.handle_payment_completion() TO service_role;
REVOKE ALL ON FUNCTION marie_wedding.mark_payment_completed(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marie_wedding.mark_payment_failed(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marie_wedding.mark_payment_completed(UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.mark_payment_failed(UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
