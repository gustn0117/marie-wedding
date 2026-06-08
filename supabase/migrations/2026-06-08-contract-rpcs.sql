-- 계약 상태 전이 + 서명 + 부수 효과 RPC
-- 양방 서명 시 자동 'signed' 전환은 이미 trg_check_contract_full_signed 트리거로 처리됨.
-- 본 RPC는 서명 자체 등록 + 권한 가드.

-- ─────────────────────────────────────────────────────────
-- sign_contract — 양 당사자 한쪽이 서명. 양방 서명 시 trigger가 status='signed' 전환.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.sign_contract(
  p_contract_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS marie_wedding.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_contract marie_wedding.contracts%ROWTYPE;
  v_signer_side TEXT;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_contract
  FROM marie_wedding.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contract_not_found';
  END IF;

  IF v_contract.status NOT IN ('draft', 'awaiting_signatures') THEN
    RAISE EXCEPTION 'invalid_status_for_signing_%', v_contract.status;
  END IF;

  IF v_caller = v_contract.party_a_profile_id THEN
    v_signer_side := 'party_a';
  ELSIF v_caller = v_contract.party_b_profile_id THEN
    v_signer_side := 'party_b';
  ELSE
    RAISE EXCEPTION 'not_party_to_contract';
  END IF;

  -- 이미 같은 측이 서명했으면 중복 거부 (UNIQUE 제약이 있지만 명시적 메시지)
  IF EXISTS (
    SELECT 1 FROM marie_wedding.contract_signatures
    WHERE contract_id = p_contract_id AND signer_side = v_signer_side
  ) THEN
    RAISE EXCEPTION 'already_signed';
  END IF;

  -- draft였으면 awaiting_signatures로 먼저 전환
  IF v_contract.status = 'draft' THEN
    UPDATE marie_wedding.contracts
    SET status = 'awaiting_signatures'
    WHERE id = p_contract_id;
  END IF;

  -- 서명 INSERT (trigger가 양방 서명 확인 후 contracts.status='signed' 전환)
  INSERT INTO marie_wedding.contract_signatures (
    contract_id, signer_profile_id, signer_side, ip_address, user_agent
  ) VALUES (
    p_contract_id, v_caller, v_signer_side, p_ip_address, p_user_agent
  );

  -- 갱신된 상태 반환
  SELECT * INTO v_contract FROM marie_wedding.contracts WHERE id = p_contract_id;
  RETURN v_contract;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- cancel_contract — 양 당사자 누구나 가능, signed 이후엔 disputed로 전환
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.cancel_contract(
  p_contract_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS marie_wedding.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_contract marie_wedding.contracts%ROWTYPE;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_contract FROM marie_wedding.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;

  IF v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_contract';
  END IF;

  IF v_contract.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status_for_cancel_%', v_contract.status;
  END IF;

  -- signed/in_progress 이후엔 그냥 cancelled로 넘기지 않고 분쟁(disputed)으로 (일방 취소 방지)
  -- draft/awaiting_signatures는 단순 취소 가능
  IF v_contract.status IN ('draft', 'awaiting_signatures') THEN
    UPDATE marie_wedding.contracts
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = v_caller,
        cancellation_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
    WHERE id = p_contract_id
    RETURNING * INTO v_contract;
  ELSE
    -- signed/in_progress → disputed (관리자/합의로 해결 필요)
    UPDATE marie_wedding.contracts
    SET status = 'disputed',
        cancelled_at = NOW(),
        cancelled_by = v_caller,
        cancellation_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
    WHERE id = p_contract_id
    RETURNING * INTO v_contract;
  END IF;

  RETURN v_contract;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- mark_contract_completed — 계약 양 당사자 모두가 완료 처리 (양방 합의)
-- 단순화: 한쪽이 호출하면 in_progress, 양쪽 모두 호출하면 completed.
-- 본 단계에선 한쪽 호출만으로 completed로 전환 (양방 확인은 Milestone 1.5 정산에서 강화)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.mark_contract_in_progress(
  p_contract_id UUID
)
RETURNS marie_wedding.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_contract marie_wedding.contracts%ROWTYPE;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_contract FROM marie_wedding.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_contract';
  END IF;
  IF v_contract.status != 'signed' THEN
    RAISE EXCEPTION 'invalid_status_for_progress_%', v_contract.status;
  END IF;

  UPDATE marie_wedding.contracts SET status = 'in_progress'
  WHERE id = p_contract_id
  RETURNING * INTO v_contract;

  RETURN v_contract;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.complete_contract(
  p_contract_id UUID
)
RETURNS marie_wedding.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_contract marie_wedding.contracts%ROWTYPE;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_contract FROM marie_wedding.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_contract';
  END IF;
  IF v_contract.status NOT IN ('signed', 'in_progress') THEN
    RAISE EXCEPTION 'invalid_status_for_complete_%', v_contract.status;
  END IF;

  UPDATE marie_wedding.contracts SET status = 'completed', completed_at = NOW()
  WHERE id = p_contract_id
  RETURNING * INTO v_contract;

  RETURN v_contract;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- create_booking_from_contract — 계약이 signed 되면 booking 자동 생성 헬퍼.
-- 실제 호출 패턴:
--   1. 계약 양방 서명 시 trg_check_contract_full_signed로 status='signed' 전환
--   2. 클라이언트가 이 RPC 호출 (party_b를 공급자로 간주 — 보통 vendor)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.create_booking_from_contract(
  p_contract_id UUID,
  p_provider_side TEXT DEFAULT 'party_b',  -- 'party_a' or 'party_b'
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS marie_wedding.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_contract marie_wedding.contracts%ROWTYPE;
  v_provider UUID;
  v_booking marie_wedding.bookings%ROWTYPE;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_contract FROM marie_wedding.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_contract';
  END IF;
  IF v_contract.status NOT IN ('signed', 'in_progress') THEN
    RAISE EXCEPTION 'contract_not_signed';
  END IF;

  -- 이미 예약된 게 있으면 거부
  IF EXISTS (SELECT 1 FROM marie_wedding.bookings WHERE contract_id = p_contract_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'booking_already_exists';
  END IF;

  v_provider := CASE WHEN p_provider_side = 'party_a' THEN v_contract.party_a_profile_id ELSE v_contract.party_b_profile_id END;

  INSERT INTO marie_wedding.bookings (
    contract_id, provider_profile_id, event_date, start_time, end_time, venue, status, note
  ) VALUES (
    p_contract_id, v_provider, v_contract.event_date, p_start_time, p_end_time, v_contract.event_venue, 'scheduled', p_note
  ) RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

NOTIFY pgrst, 'reload schema';
