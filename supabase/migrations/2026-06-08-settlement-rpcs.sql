-- 정산(settlement) RPC
-- 흐름: 계약 completed → 정산 자동 생성(pending) → 어드민 approve → processing → paid
-- 수수료 계산: net = gross - platform_fee - tax_withheld
-- 플랫폼 수수료율은 환경별 설정 (기본 0, 추후 settings 테이블로 분리 가능)

-- 글로벌 플랫폼 수수료율 (현재는 함수 내 상수, 추후 settings 테이블 추가 시 select로 교체)
CREATE OR REPLACE FUNCTION marie_wedding.platform_fee_rate()
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 0.05::NUMERIC  -- 5% 기본
$$;

-- ─────────────────────────────────────────────────────────
-- 1. 계약 → 정산 자동 생성
-- 계약 양 당사자 중 공급자(party_b 가정)에게 정산 생성.
-- 자동 호출: 계약 완료 시점. 수동 호출: 어드민이 누락 분 보충용.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.create_settlement_from_contract(
  p_contract_id UUID,
  p_payee_side TEXT DEFAULT 'party_b',  -- party_a or party_b
  p_fee_rate_override NUMERIC DEFAULT NULL
)
RETURNS marie_wedding.settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_contract marie_wedding.contracts%ROWTYPE;
  v_payee UUID;
  v_fee_rate NUMERIC;
  v_gross NUMERIC;
  v_fee_amount NUMERIC;
  v_net NUMERIC;
  v_settlement marie_wedding.settlements%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_contract FROM marie_wedding.contracts WHERE id = p_contract_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;

  -- 권한: 계약 당사자 또는 admin
  IF v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id)
     AND NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'not_party_to_contract';
  END IF;

  -- 계약이 completed 상태여야 정산 가능
  IF v_contract.status != 'completed' THEN
    RAISE EXCEPTION 'contract_not_completed';
  END IF;

  -- 이미 정산이 있으면 거부
  IF EXISTS (SELECT 1 FROM marie_wedding.settlements WHERE contract_id = p_contract_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'settlement_already_exists';
  END IF;

  v_payee := CASE WHEN p_payee_side = 'party_a' THEN v_contract.party_a_profile_id ELSE v_contract.party_b_profile_id END;
  v_fee_rate := COALESCE(p_fee_rate_override, marie_wedding.platform_fee_rate());
  v_gross := v_contract.total_amount;
  v_fee_amount := ROUND(v_gross * v_fee_rate);
  v_net := v_gross - v_fee_amount;  -- 현재 tax_withheld 0

  INSERT INTO marie_wedding.settlements (
    contract_id, payee_profile_id,
    gross_amount, platform_fee_rate, platform_fee_amount, tax_withheld, net_amount,
    status
  ) VALUES (
    p_contract_id, v_payee,
    v_gross, v_fee_rate, v_fee_amount, 0, v_net,
    'pending'
  ) RETURNING * INTO v_settlement;

  RETURN v_settlement;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 2. 어드민 승인 — pending → approved
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.approve_settlement(
  p_settlement_id UUID,
  p_scheduled_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS marie_wedding.settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_settlement marie_wedding.settlements%ROWTYPE;
BEGIN
  IF NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT * INTO v_settlement FROM marie_wedding.settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  IF v_settlement.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status_for_approve_%', v_settlement.status;
  END IF;

  UPDATE marie_wedding.settlements
  SET status = 'approved',
      scheduled_at = COALESCE(p_scheduled_at, NOW() + INTERVAL '3 days')
  WHERE id = p_settlement_id
  RETURNING * INTO v_settlement;

  RETURN v_settlement;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 3. 송금 처리 시작 — approved → processing
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.process_settlement(
  p_settlement_id UUID,
  p_payout_method TEXT DEFAULT 'bank_transfer',
  p_payout_account TEXT DEFAULT NULL,
  p_payout_reference TEXT DEFAULT NULL
)
RETURNS marie_wedding.settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_settlement marie_wedding.settlements%ROWTYPE;
BEGIN
  IF NOT marie_wedding.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;

  SELECT * INTO v_settlement FROM marie_wedding.settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  IF v_settlement.status != 'approved' THEN
    RAISE EXCEPTION 'invalid_status_for_process_%', v_settlement.status;
  END IF;

  UPDATE marie_wedding.settlements
  SET status = 'processing',
      payout_method = p_payout_method,
      payout_account = p_payout_account,
      payout_reference = p_payout_reference
  WHERE id = p_settlement_id
  RETURNING * INTO v_settlement;

  RETURN v_settlement;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 4. 송금 완료 — processing → paid
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.mark_settlement_paid(
  p_settlement_id UUID,
  p_payout_reference TEXT DEFAULT NULL
)
RETURNS marie_wedding.settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_settlement marie_wedding.settlements%ROWTYPE;
BEGIN
  IF NOT marie_wedding.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;

  SELECT * INTO v_settlement FROM marie_wedding.settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  IF v_settlement.status NOT IN ('approved', 'processing') THEN
    RAISE EXCEPTION 'invalid_status_for_paid_%', v_settlement.status;
  END IF;

  UPDATE marie_wedding.settlements
  SET status = 'paid',
      paid_at = NOW(),
      payout_reference = COALESCE(p_payout_reference, payout_reference)
  WHERE id = p_settlement_id
  RETURNING * INTO v_settlement;

  RETURN v_settlement;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 5. 송금 실패 표시 — processing → failed
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.fail_settlement(
  p_settlement_id UUID,
  p_reason TEXT
)
RETURNS marie_wedding.settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_settlement marie_wedding.settlements%ROWTYPE;
BEGIN
  IF NOT marie_wedding.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;

  SELECT * INTO v_settlement FROM marie_wedding.settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  IF v_settlement.status NOT IN ('approved', 'processing') THEN
    RAISE EXCEPTION 'invalid_status_for_fail_%', v_settlement.status;
  END IF;

  UPDATE marie_wedding.settlements
  SET status = 'failed',
      failed_at = NOW(),
      failure_reason = NULLIF(TRIM(p_reason), '')
  WHERE id = p_settlement_id
  RETURNING * INTO v_settlement;

  RETURN v_settlement;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 6. 정산 취소 (pending 단계만 — 양 당사자 또는 admin)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.cancel_settlement(
  p_settlement_id UUID
)
RETURNS marie_wedding.settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_settlement marie_wedding.settlements%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_settlement FROM marie_wedding.settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;

  IF v_caller != v_settlement.payee_profile_id AND NOT marie_wedding.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_settlement.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status_for_cancel_%', v_settlement.status;
  END IF;

  UPDATE marie_wedding.settlements
  SET status = 'cancelled'
  WHERE id = p_settlement_id
  RETURNING * INTO v_settlement;

  RETURN v_settlement;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 7. 계약 complete 시 정산 자동 생성 (트리거)
-- 기존 complete_contract RPC가 호출되면 자동으로 정산 생성.
-- 단, party_b가 공급자라고 가정 — 추후 ui에서 선택 가능하게.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.auto_create_settlement_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_fee_rate NUMERIC;
  v_gross NUMERIC;
  v_fee_amount NUMERIC;
BEGIN
  -- completed로 전환된 순간 + 정산 미존재면 생성
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NOT EXISTS (SELECT 1 FROM marie_wedding.settlements WHERE contract_id = NEW.id AND deleted_at IS NULL) THEN
      v_fee_rate := marie_wedding.platform_fee_rate();
      v_gross := NEW.total_amount;
      v_fee_amount := ROUND(v_gross * v_fee_rate);

      INSERT INTO marie_wedding.settlements (
        contract_id, payee_profile_id,
        gross_amount, platform_fee_rate, platform_fee_amount, tax_withheld, net_amount,
        status
      ) VALUES (
        NEW.id, NEW.party_b_profile_id,  -- 기본 party_b를 공급자로
        v_gross, v_fee_rate, v_fee_amount, 0, v_gross - v_fee_amount,
        'pending'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_settlement_on_contract_complete ON marie_wedding.contracts;
CREATE TRIGGER trg_auto_settlement_on_contract_complete
  AFTER UPDATE ON marie_wedding.contracts
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.auto_create_settlement_on_complete();

NOTIFY pgrst, 'reload schema';
