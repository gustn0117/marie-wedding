-- 결제 RPC + premium_tier 자동 업그레이드 트리거
-- 포트원 V2 연동용

-- ─────────────────────────────────────────────────────────
-- 1. 결제 세션 생성 (서버 측에서 호출)
-- 사용자 클릭 → /api/payments/start → payments INSERT (pending) → portone SDK로 위젯 띄움
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.create_payment_session(
  p_profile_id UUID,
  p_product_type TEXT,
  p_product_id UUID DEFAULT NULL,
  p_amount INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS marie_wedding.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_payment marie_wedding.payments%ROWTYPE;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_product_type NOT IN ('job_promotion', 'premium_tier', 'event_listing', 'directory_boost') THEN
    RAISE EXCEPTION 'invalid_product_type';
  END IF;

  INSERT INTO marie_wedding.payments (
    profile_id, amount, currency, product_type, product_id, status, gateway, metadata
  ) VALUES (
    p_profile_id, p_amount, 'KRW', p_product_type, p_product_id, 'pending', 'portone', p_metadata
  ) RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 2. webhook에서 결제 완료 마킹
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.mark_payment_completed(
  p_payment_id UUID,
  p_gateway_transaction_id TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS marie_wedding.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_payment marie_wedding.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM marie_wedding.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF v_payment.status = 'completed' THEN
    -- 이미 완료 — idempotent
    RETURN v_payment;
  END IF;
  IF v_payment.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'invalid_status_for_complete_%', v_payment.status;
  END IF;

  UPDATE marie_wedding.payments
  SET status = 'completed',
      gateway_transaction_id = p_gateway_transaction_id,
      completed_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.mark_payment_failed(
  p_payment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS marie_wedding.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_payment marie_wedding.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM marie_wedding.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  UPDATE marie_wedding.payments
  SET status = 'failed',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('failure_reason', p_reason)
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 3. premium_tier 결제 완료 시 profile 자동 업그레이드
-- 트리거: payments.status가 completed 되면 product_type별 후속 처리.
-- profile.premium_tier 컬럼이 있어야 — 기존 schema에 추가되어 있을 것.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.handle_payment_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_new_tier TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- product_type별 후속 처리
    IF NEW.product_type = 'premium_tier' THEN
      -- metadata.tier 에 'basic'/'pro'/'enterprise' 기대
      v_new_tier := COALESCE(NEW.metadata->>'tier', 'basic');
      UPDATE marie_wedding.profiles
      SET premium_tier = v_new_tier
      WHERE id = NEW.profile_id;

    ELSIF NEW.product_type = 'job_promotion' AND NEW.product_id IS NOT NULL THEN
      -- 공고 promotion 30일 활성
      UPDATE marie_wedding.jobs
      SET is_promoted = true,
          promoted_until = COALESCE(promoted_until, NOW()) + INTERVAL '30 days'
      WHERE id = NEW.product_id AND author_id = NEW.profile_id;

    ELSIF NEW.product_type = 'directory_boost' THEN
      -- 디렉토리 부스트 — 추후 필드 추가 시 확장
      NULL;
    END IF;

    -- 알림 발송 (notifications 테이블)
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

DROP TRIGGER IF EXISTS trg_handle_payment_completion ON marie_wedding.payments;
CREATE TRIGGER trg_handle_payment_completion
  AFTER UPDATE ON marie_wedding.payments
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.handle_payment_completion();

NOTIFY pgrst, 'reload schema';
