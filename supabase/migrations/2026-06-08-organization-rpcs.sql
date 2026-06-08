-- 조직 권한 RPC (organization_members 활용)
-- 사용 패턴: profiles는 1:1 owner 계정, organizations는 그 owner의 사업체.
-- 한 사람이 여러 조직에 속할 수 있음 (예: 부업·이직).

-- 권한 체크 헬퍼
CREATE OR REPLACE FUNCTION marie_wedding.org_role_of(
  p_org_id UUID,
  p_profile_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  SELECT role FROM marie_wedding.organization_members
  WHERE organization_id = p_org_id
    AND member_profile_id = p_profile_id
    AND deleted_at IS NULL
    AND accepted_at IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.is_org_member(
  p_org_id UUID,
  p_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM marie_wedding.organization_members
    WHERE organization_id = p_org_id
      AND member_profile_id = p_profile_id
      AND deleted_at IS NULL
      AND accepted_at IS NOT NULL
  );
$$;

-- ─────────────────────────────────────────────────────────
-- 조직 생성 (자동으로 owner 멤버십 생성)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.create_organization(
  p_name TEXT,
  p_business_number TEXT DEFAULT NULL,
  p_representative_name TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS marie_wedding.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_org marie_wedding.organizations%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_name IS NULL OR TRIM(p_name) = '' THEN RAISE EXCEPTION 'name_required'; END IF;

  INSERT INTO marie_wedding.organizations (owner_profile_id, name, business_number, representative_name, address)
  VALUES (v_caller, TRIM(p_name), NULLIF(TRIM(COALESCE(p_business_number, '')), ''), NULLIF(TRIM(COALESCE(p_representative_name, '')), ''), NULLIF(TRIM(COALESCE(p_address, '')), ''))
  RETURNING * INTO v_org;

  -- owner 멤버십 자동 생성
  INSERT INTO marie_wedding.organization_members (organization_id, member_profile_id, role, accepted_at)
  VALUES (v_org.id, v_caller, 'owner', NOW());

  RETURN v_org;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 멤버 초대 — owner/manager만 가능
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.invite_organization_member(
  p_org_id UUID,
  p_member_profile_id UUID,
  p_role TEXT
)
RETURNS marie_wedding.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_caller_role TEXT;
  v_member marie_wedding.organization_members%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_role NOT IN ('manager', 'staff') THEN
    RAISE EXCEPTION 'invalid_role'; -- owner는 조직 생성 시점에만 1명
  END IF;

  v_caller_role := marie_wedding.org_role_of(p_org_id, v_caller);
  IF v_caller_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'not_authorized_to_invite';
  END IF;

  -- 본인 초대 금지
  IF v_caller = p_member_profile_id THEN
    RAISE EXCEPTION 'cannot_invite_self';
  END IF;

  -- 이미 멤버인 경우 (활성 + soft delete 양쪽)
  IF EXISTS (
    SELECT 1 FROM marie_wedding.organization_members
    WHERE organization_id = p_org_id AND member_profile_id = p_member_profile_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO marie_wedding.organization_members (organization_id, member_profile_id, role)
  VALUES (p_org_id, p_member_profile_id, p_role)
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 초대 수락 (받은 사람 본인)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.accept_organization_invite(
  p_member_id UUID
)
RETURNS marie_wedding.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_member marie_wedding.organization_members%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_member FROM marie_wedding.organization_members
  WHERE id = p_member_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF v_member.member_profile_id != v_caller THEN
    RAISE EXCEPTION 'not_your_invite';
  END IF;
  IF v_member.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_accepted';
  END IF;

  UPDATE marie_wedding.organization_members
  SET accepted_at = NOW()
  WHERE id = p_member_id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 권한 변경 (owner만)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.update_member_role(
  p_member_id UUID,
  p_new_role TEXT
)
RETURNS marie_wedding.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_member marie_wedding.organization_members%ROWTYPE;
  v_caller_role TEXT;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_new_role NOT IN ('manager', 'staff') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  SELECT * INTO v_member FROM marie_wedding.organization_members
  WHERE id = p_member_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'cannot_change_owner_role';
  END IF;

  v_caller_role := marie_wedding.org_role_of(v_member.organization_id, v_caller);
  IF v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'only_owner_can_change_role';
  END IF;

  UPDATE marie_wedding.organization_members
  SET role = p_new_role
  WHERE id = p_member_id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 멤버 제거 (owner 또는 본인)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marie_wedding.remove_organization_member(
  p_member_id UUID
)
RETURNS marie_wedding.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_member marie_wedding.organization_members%ROWTYPE;
  v_caller_role TEXT;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_member FROM marie_wedding.organization_members
  WHERE id = p_member_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;

  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'cannot_remove_owner';
  END IF;

  -- 본인 탈퇴 또는 owner 권한
  v_caller_role := marie_wedding.org_role_of(v_member.organization_id, v_caller);
  IF v_caller != v_member.member_profile_id AND v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE marie_wedding.organization_members
  SET deleted_at = NOW()
  WHERE id = p_member_id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

NOTIFY pgrst, 'reload schema';
