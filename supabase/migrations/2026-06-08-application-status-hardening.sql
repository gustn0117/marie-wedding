-- 지원/문의 상태 변경 권한 강화
-- 작성자는 검토/승인/거절만, 지원자는 취소만 수행한다.

CREATE OR REPLACE FUNCTION marie_wedding.set_application_status(
  p_application_id UUID,
  p_status TEXT
)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_app marie_wedding.applications%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
BEGIN
  SELECT id INTO v_caller
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_app
  FROM marie_wedding.applications
  WHERE id = p_application_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  SELECT * INTO v_job
  FROM marie_wedding.jobs
  WHERE id = v_app.job_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_caller = v_job.author_id THEN
    IF p_status NOT IN ('reviewing', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'status_not_allowed_for_author';
    END IF;
  ELSIF v_caller = v_app.applicant_id THEN
    IF p_status <> 'cancelled' THEN
      RAISE EXCEPTION 'status_not_allowed_for_applicant';
    END IF;
    IF v_app.status NOT IN ('pending', 'reviewing') THEN
      RAISE EXCEPTION 'cannot_cancel_final_status';
    END IF;
  ELSE
    RAISE EXCEPTION 'not_party_to_application';
  END IF;

  UPDATE marie_wedding.applications
  SET status = p_status
  WHERE id = p_application_id
  RETURNING * INTO v_app;

  RETURN v_app;
END;
$$;

DROP POLICY IF EXISTS applications_update_related ON marie_wedding.applications;
DROP POLICY IF EXISTS applications_admin_update ON marie_wedding.applications;
CREATE POLICY applications_admin_update ON marie_wedding.applications
  FOR UPDATE USING (marie_wedding.is_admin())
  WITH CHECK (marie_wedding.is_admin());

NOTIFY pgrst, 'reload schema';
