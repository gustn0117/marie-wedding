-- 견적 상태 전이 RPC + 헬퍼
-- 상태 머신:
--   draft → sent (sender만)
--   sent/viewed → accepted | rejected (receiver만)
--   draft/sent/viewed → cancelled (sender만)
--   sent → viewed (자동, receiver 첫 SELECT 시 별도 호출)
--   그 외 → expired (cron, valid_until 지남)

CREATE OR REPLACE FUNCTION marie_wedding.transition_quotation_status(
  p_quotation_id UUID,
  p_to_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS marie_wedding.quotations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_quotation marie_wedding.quotations%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_quotation
  FROM marie_wedding.quotations
  WHERE id = p_quotation_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quotation_not_found';
  END IF;

  -- 권한 + 상태 전이 가드
  IF p_to_status = 'sent' THEN
    IF v_caller != v_quotation.sender_profile_id THEN
      RAISE EXCEPTION 'only_sender_can_send';
    END IF;
    IF v_quotation.status != 'draft' THEN
      RAISE EXCEPTION 'invalid_transition_from_%', v_quotation.status;
    END IF;
    UPDATE marie_wedding.quotations
    SET status = 'sent', sent_at = v_now
    WHERE id = p_quotation_id
    RETURNING * INTO v_quotation;

  ELSIF p_to_status = 'viewed' THEN
    -- receiver의 자동 호출. sent → viewed 만 허용.
    IF v_caller != v_quotation.receiver_profile_id THEN
      RAISE EXCEPTION 'only_receiver_can_view';
    END IF;
    IF v_quotation.status = 'sent' THEN
      UPDATE marie_wedding.quotations
      SET status = 'viewed', viewed_at = v_now
      WHERE id = p_quotation_id
      RETURNING * INTO v_quotation;
    END IF;

  ELSIF p_to_status = 'accepted' THEN
    IF v_caller != v_quotation.receiver_profile_id THEN
      RAISE EXCEPTION 'only_receiver_can_accept';
    END IF;
    IF v_quotation.status NOT IN ('sent', 'viewed') THEN
      RAISE EXCEPTION 'invalid_transition_from_%', v_quotation.status;
    END IF;
    UPDATE marie_wedding.quotations
    SET status = 'accepted', responded_at = v_now
    WHERE id = p_quotation_id
    RETURNING * INTO v_quotation;

  ELSIF p_to_status = 'rejected' THEN
    IF v_caller != v_quotation.receiver_profile_id THEN
      RAISE EXCEPTION 'only_receiver_can_reject';
    END IF;
    IF v_quotation.status NOT IN ('sent', 'viewed') THEN
      RAISE EXCEPTION 'invalid_transition_from_%', v_quotation.status;
    END IF;
    UPDATE marie_wedding.quotations
    SET status = 'rejected',
        responded_at = v_now,
        rejection_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
    WHERE id = p_quotation_id
    RETURNING * INTO v_quotation;

  ELSIF p_to_status = 'cancelled' THEN
    IF v_caller != v_quotation.sender_profile_id THEN
      RAISE EXCEPTION 'only_sender_can_cancel';
    END IF;
    IF v_quotation.status NOT IN ('draft', 'sent', 'viewed') THEN
      RAISE EXCEPTION 'invalid_transition_from_%', v_quotation.status;
    END IF;
    UPDATE marie_wedding.quotations
    SET status = 'cancelled'
    WHERE id = p_quotation_id
    RETURNING * INTO v_quotation;

  ELSE
    RAISE EXCEPTION 'unknown_target_status_%', p_to_status;
  END IF;

  RETURN v_quotation;
END;
$$;

-- 견적 만료 처리 (cron 일일 호출)
CREATE OR REPLACE FUNCTION marie_wedding.expire_quotations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE marie_wedding.quotations
  SET status = 'expired'
  WHERE status IN ('sent', 'viewed')
    AND valid_until IS NOT NULL
    AND valid_until < CURRENT_DATE
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 견적 → 계약 자동 생성
-- accepted 견적에서 호출하면 contract 신규 + 라인 정보 스냅샷.
CREATE OR REPLACE FUNCTION marie_wedding.create_contract_from_quotation(
  p_quotation_id UUID,
  p_event_date DATE,
  p_payment_terms TEXT DEFAULT NULL,
  p_cancellation_terms TEXT DEFAULT NULL
)
RETURNS marie_wedding.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_quotation marie_wedding.quotations%ROWTYPE;
  v_contract marie_wedding.contracts%ROWTYPE;
  v_party_a_name TEXT;
  v_party_b_name TEXT;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_quotation
  FROM marie_wedding.quotations
  WHERE id = p_quotation_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quotation_not_found';
  END IF;

  IF v_quotation.status != 'accepted' THEN
    RAISE EXCEPTION 'quotation_not_accepted';
  END IF;

  -- 양 당사자 중 하나여야
  IF v_caller NOT IN (v_quotation.sender_profile_id, v_quotation.receiver_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_quotation';
  END IF;

  -- 이미 생성된 계약이 있으면 거부
  IF EXISTS (SELECT 1 FROM marie_wedding.contracts WHERE quotation_id = p_quotation_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'contract_already_exists';
  END IF;

  SELECT COALESCE(company_name, contact_name) INTO v_party_a_name
  FROM marie_wedding.profiles WHERE id = v_quotation.sender_profile_id;

  SELECT COALESCE(company_name, contact_name) INTO v_party_b_name
  FROM marie_wedding.profiles WHERE id = v_quotation.receiver_profile_id;

  INSERT INTO marie_wedding.contracts (
    quotation_id,
    party_a_profile_id, party_b_profile_id,
    party_a_org_name, party_b_org_name,
    title, description,
    event_date, event_venue,
    total_amount, currency,
    payment_terms, cancellation_terms,
    status
  ) VALUES (
    p_quotation_id,
    v_quotation.sender_profile_id, v_quotation.receiver_profile_id,
    COALESCE(v_party_a_name, '미상'), COALESCE(v_party_b_name, '미상'),
    v_quotation.title, v_quotation.description,
    COALESCE(p_event_date, v_quotation.event_date, CURRENT_DATE + INTERVAL '30 days'),
    v_quotation.event_venue,
    v_quotation.total_amount, v_quotation.currency,
    p_payment_terms, p_cancellation_terms,
    'awaiting_signatures'
  ) RETURNING * INTO v_contract;

  RETURN v_contract;
END;
$$;

NOTIFY pgrst, 'reload schema';
