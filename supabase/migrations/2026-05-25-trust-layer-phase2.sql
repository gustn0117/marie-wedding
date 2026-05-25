-- 신뢰 레이어 Phase 2: 거래 완료 RPC + 한쪽 완료 알림
-- 작성일: 2026-05-25

-- 거래 완료 표시 RPC: 호출자가 hiring 측인지 applicant 측인지 판단해 해당 컬럼만 set
CREATE OR REPLACE FUNCTION marie_wedding.mark_deal_completed(p_application_id UUID)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_app marie_wedding.applications%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
  v_caller_profile UUID;
BEGIN
  SELECT id INTO v_caller_profile
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller_profile IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_app FROM marie_wedding.applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = v_app.job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_app.status <> 'accepted' THEN
    RAISE EXCEPTION 'not_accepted';
  END IF;

  IF v_caller_profile = v_job.author_id THEN
    IF v_app.hiring_completed_at IS NULL THEN
      UPDATE marie_wedding.applications
      SET hiring_completed_at = NOW()
      WHERE id = p_application_id
      RETURNING * INTO v_app;
    END IF;
  ELSIF v_caller_profile = v_app.applicant_id THEN
    IF v_app.applicant_completed_at IS NULL THEN
      UPDATE marie_wedding.applications
      SET applicant_completed_at = NOW()
      WHERE id = p_application_id
      RETURNING * INTO v_app;
    END IF;
  ELSE
    RAISE EXCEPTION 'not_party_to_application';
  END IF;

  RETURN v_app;
END;
$$;

-- 한 쪽이 완료 처리한 경우 상대방에게 알림 (양쪽 완료 시점은 기존 notify_deal_completed가 처리)
CREATE OR REPLACE FUNCTION marie_wedding.notify_one_side_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_job marie_wedding.jobs%ROWTYPE;
  v_target UUID;
  v_completer_name TEXT;
BEGIN
  SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = NEW.job_id;

  IF OLD.hiring_completed_at IS NULL AND NEW.hiring_completed_at IS NOT NULL
     AND NEW.applicant_completed_at IS NULL THEN
    v_target := NEW.applicant_id;
    SELECT COALESCE(company_name, contact_name, '상대') INTO v_completer_name
      FROM marie_wedding.profiles WHERE id = v_job.author_id;
    INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
    VALUES (v_target, 'deal_half_completed', '거래 완료 확인 요청',
      v_completer_name || '님이 "' || v_job.title || '" 거래 완료를 표시했습니다. 확인해 주세요.',
      '/mypage');
  END IF;

  IF OLD.applicant_completed_at IS NULL AND NEW.applicant_completed_at IS NOT NULL
     AND NEW.hiring_completed_at IS NULL THEN
    v_target := v_job.author_id;
    SELECT COALESCE(company_name, contact_name, '상대') INTO v_completer_name
      FROM marie_wedding.profiles WHERE id = NEW.applicant_id;
    INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
    VALUES (v_target, 'deal_half_completed', '거래 완료 확인 요청',
      v_completer_name || '님이 "' || v_job.title || '" 거래 완료를 표시했습니다. 확인해 주세요.',
      '/mypage');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS applications_deal_half_completed ON marie_wedding.applications;
CREATE TRIGGER applications_deal_half_completed
  AFTER UPDATE OF hiring_completed_at, applicant_completed_at ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_one_side_completed();

NOTIFY pgrst, 'reload schema';
