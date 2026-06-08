-- 예약(booking) 시스템 RPC + 충돌 검사
-- 알고리즘: 반개구간 [start, end) 겹침 판정 + NULL = ALL_DAY 처리 + availability busy 슬롯 교차

-- ─────────────────────────────────────────────────────────
-- 1. 충돌 검사 (읽기 전용)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.check_booking_conflict(
  p_provider_profile_id UUID,
  p_event_date DATE,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  contract_id UUID,
  start_time TIME,
  end_time TIME,
  status TEXT,
  is_all_day BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
BEGIN
  IF p_start_time IS NOT NULL AND p_end_time IS NOT NULL AND p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'invalid_time_range';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.contract_id,
    b.start_time,
    b.end_time,
    b.status,
    (b.start_time IS NULL OR b.end_time IS NULL) AS is_all_day
  FROM marie_wedding.bookings b
  WHERE b.provider_profile_id = p_provider_profile_id
    AND b.event_date = p_event_date
    AND b.status IN ('scheduled', 'in_progress')
    AND b.deleted_at IS NULL
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      -- 인풋이 ALL_DAY 면 같은 날 모든 booking과 충돌
      p_start_time IS NULL OR p_end_time IS NULL
      -- DB의 booking이 ALL_DAY 면 모든 시간과 충돌
      OR b.start_time IS NULL OR b.end_time IS NULL
      -- 둘 다 시간 있으면 반개구간 겹침: A.start < B.end AND B.start < A.end
      OR (p_start_time < b.end_time AND b.start_time < p_end_time)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 2. 안전 생성 — 충돌 검사 후 INSERT (트랜잭션 내)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.create_booking_safe(
  p_contract_id UUID,
  p_provider_profile_id UUID,
  p_event_date DATE,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_venue TEXT DEFAULT NULL
)
RETURNS marie_wedding.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_contract marie_wedding.contracts%ROWTYPE;
  v_booking marie_wedding.bookings%ROWTYPE;
  v_conflict_count INT;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- 계약 존재·당사자 확인
  SELECT * INTO v_contract FROM marie_wedding.contracts WHERE id = p_contract_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_contract';
  END IF;
  IF v_contract.status NOT IN ('signed', 'in_progress') THEN
    RAISE EXCEPTION 'contract_not_signed';
  END IF;
  -- provider는 양 당사자 중 한 쪽이어야
  IF p_provider_profile_id NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'provider_must_be_party';
  END IF;

  -- 충돌 검사
  SELECT COUNT(*) INTO v_conflict_count
  FROM marie_wedding.check_booking_conflict(p_provider_profile_id, p_event_date, p_start_time, p_end_time, NULL);

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'booking_conflict';
  END IF;

  -- INSERT
  INSERT INTO marie_wedding.bookings (
    contract_id, provider_profile_id, event_date, start_time, end_time, venue, status, note
  ) VALUES (
    p_contract_id, p_provider_profile_id, p_event_date, p_start_time, p_end_time, p_venue, 'scheduled', p_note
  ) RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 3. 상태 전이 가드
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.update_booking_status(
  p_booking_id UUID,
  p_next_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS marie_wedding.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_booking marie_wedding.bookings%ROWTYPE;
  v_contract marie_wedding.contracts%ROWTYPE;
  v_valid_transitions TEXT[];
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_booking FROM marie_wedding.bookings WHERE id = p_booking_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;

  -- 권한: provider 본인이거나 계약 당사자
  SELECT * INTO v_contract FROM marie_wedding.contracts WHERE id = v_booking.contract_id;
  IF v_caller != v_booking.provider_profile_id
     AND v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_booking';
  END IF;

  -- 상태 전이 표
  v_valid_transitions := CASE v_booking.status
    WHEN 'scheduled' THEN ARRAY['in_progress', 'cancelled', 'no_show']
    WHEN 'in_progress' THEN ARRAY['completed', 'cancelled', 'no_show']
    WHEN 'completed' THEN ARRAY[]::TEXT[]
    WHEN 'cancelled' THEN ARRAY['scheduled']  -- 복원 허용
    WHEN 'no_show' THEN ARRAY['scheduled']    -- 복원 허용
    ELSE ARRAY[]::TEXT[]
  END;

  IF NOT (p_next_status = ANY(v_valid_transitions)) THEN
    RAISE EXCEPTION 'invalid_transition_from_%_to_%', v_booking.status, p_next_status;
  END IF;

  UPDATE marie_wedding.bookings
  SET status = p_next_status,
      completed_at = CASE WHEN p_next_status = 'completed' THEN NOW() ELSE completed_at END,
      note = CASE WHEN p_reason IS NOT NULL THEN COALESCE(note, '') || E'\n[' || p_next_status || '] ' || p_reason ELSE note END
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 4. 시간 변경 — 충돌 재검증
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.update_booking_time(
  p_booking_id UUID,
  p_event_date DATE,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL
)
RETURNS marie_wedding.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_booking marie_wedding.bookings%ROWTYPE;
  v_contract marie_wedding.contracts%ROWTYPE;
  v_conflict_count INT;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_booking FROM marie_wedding.bookings WHERE id = p_booking_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;

  SELECT * INTO v_contract FROM marie_wedding.contracts WHERE id = v_booking.contract_id;
  IF v_caller != v_booking.provider_profile_id
     AND v_caller NOT IN (v_contract.party_a_profile_id, v_contract.party_b_profile_id) THEN
    RAISE EXCEPTION 'not_party_to_booking';
  END IF;

  -- 자기 자신 제외 충돌 검사
  SELECT COUNT(*) INTO v_conflict_count
  FROM marie_wedding.check_booking_conflict(v_booking.provider_profile_id, p_event_date, p_start_time, p_end_time, p_booking_id);

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'booking_conflict';
  END IF;

  UPDATE marie_wedding.bookings
  SET event_date = p_event_date,
      start_time = p_start_time,
      end_time = p_end_time
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 5. 월 단위 booking + 계약 조인 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.get_month_bookings(
  p_provider_profile_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  booking_id UUID,
  contract_id UUID,
  contract_title TEXT,
  counterpart_name TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  status TEXT,
  note TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  SELECT
    b.id,
    b.contract_id,
    c.title,
    -- 상대방 = provider가 party_a면 party_b 이름, 아니면 party_a 이름
    CASE WHEN b.provider_profile_id = c.party_a_profile_id THEN c.party_b_org_name ELSE c.party_a_org_name END AS counterpart_name,
    b.event_date,
    b.start_time,
    b.end_time,
    b.venue,
    b.status,
    b.note
  FROM marie_wedding.bookings b
  JOIN marie_wedding.contracts c ON c.id = b.contract_id
  WHERE b.provider_profile_id = p_provider_profile_id
    AND b.event_date >= p_from
    AND b.event_date <= p_to
    AND b.deleted_at IS NULL
  ORDER BY b.event_date, b.start_time NULLS FIRST;
$$;

-- ─────────────────────────────────────────────────────────
-- 6. 일별 통합 조회 (booking + contract.event_date + availability)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.get_day_digest(
  p_provider_profile_id UUID,
  p_date DATE
)
RETURNS TABLE (
  kind TEXT,
  ref_id UUID,
  start_time TIME,
  end_time TIME,
  label TEXT,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  -- bookings
  SELECT
    'booking'::TEXT AS kind,
    b.id AS ref_id,
    b.start_time,
    b.end_time,
    c.title AS label,
    b.status
  FROM marie_wedding.bookings b
  JOIN marie_wedding.contracts c ON c.id = b.contract_id
  WHERE b.provider_profile_id = p_provider_profile_id
    AND b.event_date = p_date
    AND b.deleted_at IS NULL
  UNION ALL
  -- contract event_date (booking 없는 계약)
  SELECT
    'contract_event'::TEXT AS kind,
    c.id AS ref_id,
    NULL::TIME,
    NULL::TIME,
    c.title AS label,
    c.status
  FROM marie_wedding.contracts c
  WHERE (c.party_a_profile_id = p_provider_profile_id OR c.party_b_profile_id = p_provider_profile_id)
    AND c.event_date = p_date
    AND c.status IN ('signed', 'in_progress')
    AND c.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM marie_wedding.bookings b2
      WHERE b2.contract_id = c.id AND b2.deleted_at IS NULL
    )
  UNION ALL
  -- availability_slots
  SELECT
    'availability'::TEXT AS kind,
    s.id AS ref_id,
    NULL::TIME,
    NULL::TIME,
    NULL::TEXT,
    s.status
  FROM marie_wedding.availability_slots s
  WHERE s.profile_id = p_provider_profile_id
    AND s.date = p_date
  ORDER BY 4 NULLS LAST, 3 NULLS LAST;
$$;

NOTIFY pgrst, 'reload schema';
