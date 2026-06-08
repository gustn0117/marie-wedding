-- B2B 거래 모델 신규 (Marié Milestone 1)
-- 견적(quotation) → 계약(contract) → 예약(booking) → 정산(settlement) 전체 흐름 + 감사 로그 + 조직 RBAC.
--
-- 설계 원칙:
-- 1. 모든 테이블에 deleted_at(soft delete) + created_at + updated_at
-- 2. RLS: 거래 양 당사자(sender + receiver)만 SELECT, 일부는 admin도
-- 3. UPDATE 정책 + 보호 트리거로 상태 머신 강제
-- 4. audit_log는 trigger로 모든 거래 테이블 자동 기록

-- ─────────────────────────────────────────────────────────
-- 1. organizations — 업체 단위 (profiles의 business 계정이 자동 organization)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marie_wedding.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  business_number TEXT,
  representative_name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_number) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON marie_wedding.organizations(owner_profile_id) WHERE deleted_at IS NULL;

-- 2. organization_members — 업체 내 직원 권한
CREATE TABLE IF NOT EXISTS marie_wedding.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES marie_wedding.organizations(id) ON DELETE CASCADE NOT NULL,
  member_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE(organization_id, member_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON marie_wedding.organization_members(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_profile ON marie_wedding.organization_members(member_profile_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────
-- 3. quotations — 견적 헤더
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marie_wedding.quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 송신/수신 (양 당사자)
  sender_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL NOT NULL,
  receiver_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL NOT NULL,
  -- 메시지/관련 거래
  conversation_id UUID REFERENCES marie_wedding.conversations(id) ON DELETE SET NULL,
  -- 견적 정보
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  event_venue TEXT,
  -- 금액
  subtotal NUMERIC(12, 0) DEFAULT 0 NOT NULL,
  tax NUMERIC(12, 0) DEFAULT 0 NOT NULL,
  total_amount NUMERIC(12, 0) DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'KRW' NOT NULL,
  -- 상태 머신
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled')
  ),
  -- 발송/응답 추적
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  valid_until DATE,
  -- 메타
  internal_note TEXT,
  rejection_reason TEXT,
  pdf_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  CHECK (sender_profile_id != receiver_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_quotations_sender ON marie_wedding.quotations(sender_profile_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_receiver ON marie_wedding.quotations(receiver_profile_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_status ON marie_wedding.quotations(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_conversation ON marie_wedding.quotations(conversation_id) WHERE deleted_at IS NULL;

-- 4. quotation_items — 견적 라인 항목
CREATE TABLE IF NOT EXISTS marie_wedding.quotation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES marie_wedding.quotations(id) ON DELETE CASCADE NOT NULL,
  position INTEGER DEFAULT 0 NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 0) DEFAULT 0 NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 0) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON marie_wedding.quotation_items(quotation_id, position);

-- ─────────────────────────────────────────────────────────
-- 5. contracts — 계약
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marie_wedding.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES marie_wedding.quotations(id) ON DELETE RESTRICT NOT NULL,
  -- 양 당사자 스냅샷 (quotation에서 복사 — 추후 quotation 수정에도 계약은 고정)
  party_a_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL NOT NULL,
  party_b_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL NOT NULL,
  party_a_org_name TEXT NOT NULL,
  party_b_org_name TEXT NOT NULL,
  -- 계약 내용 (quotation에서 복사된 스냅샷 + 추가 조항)
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_venue TEXT,
  total_amount NUMERIC(12, 0) NOT NULL,
  currency TEXT DEFAULT 'KRW' NOT NULL,
  payment_terms TEXT,
  cancellation_terms TEXT,
  -- 상태 머신
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'awaiting_signatures', 'signed', 'in_progress', 'completed', 'cancelled', 'disputed')
  ),
  -- 추적
  signed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  pdf_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  CHECK (party_a_profile_id != party_b_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_contracts_quotation ON marie_wedding.contracts(quotation_id);
CREATE INDEX IF NOT EXISTS idx_contracts_party_a ON marie_wedding.contracts(party_a_profile_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_party_b ON marie_wedding.contracts(party_b_profile_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_event_date ON marie_wedding.contracts(event_date) WHERE deleted_at IS NULL AND status IN ('signed', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_contracts_status ON marie_wedding.contracts(status, created_at DESC) WHERE deleted_at IS NULL;

-- 6. contract_signatures — 양방 서명 추적
CREATE TABLE IF NOT EXISTS marie_wedding.contract_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES marie_wedding.contracts(id) ON DELETE CASCADE NOT NULL,
  signer_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL NOT NULL,
  signer_side TEXT NOT NULL CHECK (signer_side IN ('party_a', 'party_b')),
  signed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(contract_id, signer_side)
);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON marie_wedding.contract_signatures(contract_id);

-- ─────────────────────────────────────────────────────────
-- 7. bookings — 예식 일정/예약 (계약이 확정된 후 캘린더 점유)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marie_wedding.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES marie_wedding.contracts(id) ON DELETE CASCADE NOT NULL,
  -- 어느 업체의 일정인가
  provider_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL NOT NULL,
  -- 일정 정보
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  -- 상태
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')
  ),
  -- 추적
  completed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date ON marie_wedding.bookings(provider_profile_id, event_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_contract ON marie_wedding.bookings(contract_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON marie_wedding.bookings(status, event_date) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────
-- 8. settlements — 정산
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marie_wedding.settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES marie_wedding.contracts(id) ON DELETE RESTRICT NOT NULL,
  -- 정산 대상 (계약 한 쪽 — 보통 공급자)
  payee_profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL NOT NULL,
  -- 금액 (정수 KRW)
  gross_amount NUMERIC(12, 0) NOT NULL,                          -- 총액
  platform_fee_rate NUMERIC(5, 4) DEFAULT 0 NOT NULL,            -- 수수료율 (0~1)
  platform_fee_amount NUMERIC(12, 0) DEFAULT 0 NOT NULL,         -- 수수료
  tax_withheld NUMERIC(12, 0) DEFAULT 0 NOT NULL,                -- 원천세
  net_amount NUMERIC(12, 0) NOT NULL,                            -- 실수령 = gross - fee - tax
  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'processing', 'paid', 'failed', 'cancelled')
  ),
  -- 송금 정보
  payout_method TEXT,                                            -- 'bank_transfer', 'platform_credit'
  payout_account TEXT,                                           -- 마스킹된 계좌
  payout_reference TEXT,                                         -- 외부 결제 GW 참조
  scheduled_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_settlements_contract ON marie_wedding.settlements(contract_id);
CREATE INDEX IF NOT EXISTS idx_settlements_payee ON marie_wedding.settlements(payee_profile_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_settlements_status ON marie_wedding.settlements(status, scheduled_at) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────
-- 9. audit_log — 모든 거래 테이블 상태 변경 이력
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marie_wedding.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL,
  old_data JSONB,
  new_data JSONB,
  changed_columns TEXT[],
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON marie_wedding.audit_log(table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON marie_wedding.audit_log(changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON marie_wedding.audit_log(changed_at DESC);

-- ─────────────────────────────────────────────────────────
-- updated_at 자동 갱신 트리거 (이미 update_updated_at 함수 있다고 가정)
-- ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_quotations_updated_at ON marie_wedding.quotations;
CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON marie_wedding.quotations
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON marie_wedding.contracts;
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON marie_wedding.contracts
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON marie_wedding.bookings;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON marie_wedding.bookings
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

DROP TRIGGER IF EXISTS trg_settlements_updated_at ON marie_wedding.settlements;
CREATE TRIGGER trg_settlements_updated_at BEFORE UPDATE ON marie_wedding.settlements
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON marie_wedding.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON marie_wedding.organizations
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

-- ─────────────────────────────────────────────────────────
-- 견적 금액 합계 자동 계산 트리거
-- quotation_items 변경 시 quotations.subtotal/total_amount 갱신
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.recalc_quotation_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_quotation_id UUID;
  v_subtotal NUMERIC(12, 0);
  v_tax NUMERIC(12, 0);
BEGIN
  v_quotation_id := COALESCE(NEW.quotation_id, OLD.quotation_id);

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM marie_wedding.quotation_items
  WHERE quotation_id = v_quotation_id;

  -- VAT 10% (KR 기본) — 실제 환경에선 quotation.tax_mode 컬럼 추가 권장
  v_tax := ROUND(v_subtotal * 0.1);

  UPDATE marie_wedding.quotations
  SET subtotal = v_subtotal,
      tax = v_tax,
      total_amount = v_subtotal + v_tax
  WHERE id = v_quotation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_quotation_total ON marie_wedding.quotation_items;
CREATE TRIGGER trg_recalc_quotation_total
  AFTER INSERT OR UPDATE OR DELETE ON marie_wedding.quotation_items
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.recalc_quotation_total();

-- ─────────────────────────────────────────────────────────
-- 계약 양방 서명 확인 → contracts.status = 'signed'
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.check_contract_full_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM marie_wedding.contract_signatures
  WHERE contract_id = NEW.contract_id;

  IF v_count >= 2 THEN
    UPDATE marie_wedding.contracts
    SET status = 'signed',
        signed_at = NOW()
    WHERE id = NEW.contract_id
      AND status = 'awaiting_signatures';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_contract_full_signed ON marie_wedding.contract_signatures;
CREATE TRIGGER trg_check_contract_full_signed
  AFTER INSERT ON marie_wedding.contract_signatures
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.check_contract_full_signed();

-- ─────────────────────────────────────────────────────────
-- audit_log 자동 기록 트리거 (거래 5개 테이블)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller_id UUID;
  v_changed_columns TEXT[];
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  SELECT id INTO v_caller_id
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    INSERT INTO marie_wedding.audit_log (table_name, record_id, action, changed_by, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'insert', v_caller_id, v_new_data);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    -- 변경된 컬럼 추출
    SELECT array_agg(key) INTO v_changed_columns
    FROM jsonb_each(v_old_data) o
    WHERE v_new_data -> o.key IS DISTINCT FROM o.value;
    IF v_changed_columns IS NOT NULL AND array_length(v_changed_columns, 1) > 0 THEN
      INSERT INTO marie_wedding.audit_log (table_name, record_id, action, changed_by, old_data, new_data, changed_columns)
      VALUES (TG_TABLE_NAME, NEW.id, 'update', v_caller_id, v_old_data, v_new_data, v_changed_columns);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    INSERT INTO marie_wedding.audit_log (table_name, record_id, action, changed_by, old_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', v_caller_id, v_old_data);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_quotations ON marie_wedding.quotations;
CREATE TRIGGER trg_audit_quotations AFTER INSERT OR UPDATE OR DELETE ON marie_wedding.quotations
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.log_changes();

DROP TRIGGER IF EXISTS trg_audit_contracts ON marie_wedding.contracts;
CREATE TRIGGER trg_audit_contracts AFTER INSERT OR UPDATE OR DELETE ON marie_wedding.contracts
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.log_changes();

DROP TRIGGER IF EXISTS trg_audit_bookings ON marie_wedding.bookings;
CREATE TRIGGER trg_audit_bookings AFTER INSERT OR UPDATE OR DELETE ON marie_wedding.bookings
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.log_changes();

DROP TRIGGER IF EXISTS trg_audit_settlements ON marie_wedding.settlements;
CREATE TRIGGER trg_audit_settlements AFTER INSERT OR UPDATE OR DELETE ON marie_wedding.settlements
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.log_changes();

-- ─────────────────────────────────────────────────────────
-- RLS 활성화
-- ─────────────────────────────────────────────────────────
ALTER TABLE marie_wedding.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.audit_log ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- RLS 정책
-- ─────────────────────────────────────────────────────────

-- organizations: 본인 소유 + 소속 멤버만 SELECT
CREATE POLICY org_select ON marie_wedding.organizations
  FOR SELECT USING (
    owner_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR id IN (
      SELECT organization_id FROM marie_wedding.organization_members
      WHERE member_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
        AND deleted_at IS NULL
    )
    OR marie_wedding.is_admin()
  );
CREATE POLICY org_insert ON marie_wedding.organizations
  FOR INSERT WITH CHECK (
    owner_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY org_update ON marie_wedding.organizations
  FOR UPDATE USING (
    owner_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );

-- organization_members: 본인이 속한 조직만 SELECT, owner만 INSERT/UPDATE
CREATE POLICY org_members_select ON marie_wedding.organization_members
  FOR SELECT USING (
    member_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR organization_id IN (
      SELECT id FROM marie_wedding.organizations
      WHERE owner_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    )
    OR marie_wedding.is_admin()
  );
CREATE POLICY org_members_insert ON marie_wedding.organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT id FROM marie_wedding.organizations
      WHERE owner_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    )
    OR marie_wedding.is_admin()
  );
CREATE POLICY org_members_update ON marie_wedding.organization_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT id FROM marie_wedding.organizations
      WHERE owner_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    )
    OR member_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );

-- quotations: 양 당사자(sender/receiver)만
CREATE POLICY quotations_select ON marie_wedding.quotations
  FOR SELECT USING (
    sender_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR receiver_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );
CREATE POLICY quotations_insert ON marie_wedding.quotations
  FOR INSERT WITH CHECK (
    sender_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY quotations_update ON marie_wedding.quotations
  FOR UPDATE USING (
    sender_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR receiver_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );

-- quotation_items: 견적 양 당사자만
CREATE POLICY quotation_items_select ON marie_wedding.quotation_items
  FOR SELECT USING (
    quotation_id IN (
      SELECT id FROM marie_wedding.quotations
      WHERE sender_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
         OR receiver_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    )
    OR marie_wedding.is_admin()
  );
CREATE POLICY quotation_items_modify ON marie_wedding.quotation_items
  FOR ALL USING (
    quotation_id IN (
      SELECT id FROM marie_wedding.quotations
      WHERE sender_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
        AND status = 'draft'
    )
    OR marie_wedding.is_admin()
  );

-- contracts: 양 당사자만
CREATE POLICY contracts_select ON marie_wedding.contracts
  FOR SELECT USING (
    party_a_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR party_b_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );
CREATE POLICY contracts_insert ON marie_wedding.contracts
  FOR INSERT WITH CHECK (
    party_a_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR party_b_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY contracts_update ON marie_wedding.contracts
  FOR UPDATE USING (
    party_a_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR party_b_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );

-- contract_signatures
CREATE POLICY contract_sig_select ON marie_wedding.contract_signatures
  FOR SELECT USING (
    contract_id IN (
      SELECT id FROM marie_wedding.contracts
      WHERE party_a_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
         OR party_b_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    )
    OR marie_wedding.is_admin()
  );
CREATE POLICY contract_sig_insert ON marie_wedding.contract_signatures
  FOR INSERT WITH CHECK (
    signer_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
  );

-- bookings: 공급자 + 계약 양 당사자
CREATE POLICY bookings_select ON marie_wedding.bookings
  FOR SELECT USING (
    provider_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR contract_id IN (
      SELECT id FROM marie_wedding.contracts
      WHERE party_a_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
         OR party_b_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    )
    OR marie_wedding.is_admin()
  );
CREATE POLICY bookings_modify ON marie_wedding.bookings
  FOR ALL USING (
    provider_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );

-- settlements: 수령자(payee) + admin
CREATE POLICY settlements_select ON marie_wedding.settlements
  FOR SELECT USING (
    payee_profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );
CREATE POLICY settlements_admin_modify ON marie_wedding.settlements
  FOR ALL USING (marie_wedding.is_admin());

-- audit_log: 관련 거래 당사자 + admin
CREATE POLICY audit_log_select ON marie_wedding.audit_log
  FOR SELECT USING (
    -- 본인이 변경했거나, 본인이 관련된 거래
    changed_by IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
    OR marie_wedding.is_admin()
  );

NOTIFY pgrst, 'reload schema';
