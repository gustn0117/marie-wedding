-- ============================================================================
-- Individual resume system
--
-- Live resumes are private, server-managed documents.  A job application keeps
-- a separate immutable JSON snapshot so later resume edits never rewrite what
-- the hiring business originally received.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Live resume documents (multiple documents per individual profile)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marie_wedding.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL
    REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '기본 이력서'
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  full_name text NOT NULL DEFAULT ''
    CHECK (char_length(full_name) <= 100),
  email text
    CHECK (email IS NULL OR char_length(email) <= 254),
  phone text
    CHECK (phone IS NULL OR char_length(phone) <= 40),
  birth_date date,
  address text
    CHECK (address IS NULL OR char_length(address) <= 500),
  photo_path text
    CHECK (photo_path IS NULL OR char_length(photo_path) <= 1024),
  headline text
    CHECK (headline IS NULL OR char_length(headline) <= 200),
  summary text
    CHECK (summary IS NULL OR char_length(summary) <= 5000),
  desired_roles text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(desired_roles) <= 20),
  desired_regions text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(desired_regions) <= 20),
  desired_employment_types text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(desired_employment_types) <= 10),
  skills text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(skills) <= 30),
  educations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      CASE WHEN jsonb_typeof(educations) = 'array'
        THEN jsonb_array_length(educations) <= 20
        ELSE false
      END
    ),
  experiences jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      CASE WHEN jsonb_typeof(experiences) = 'array'
        THEN jsonb_array_length(experiences) <= 20
        ELSE false
      END
    ),
  certificates jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      CASE WHEN jsonb_typeof(certificates) = 'array'
        THEN jsonb_array_length(certificates) <= 30
        ELSE false
      END
    ),
  languages jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      CASE WHEN jsonb_typeof(languages) = 'array'
        THEN jsonb_array_length(languages) <= 20
        ELSE false
      END
    ),
  links jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      CASE WHEN jsonb_typeof(links) = 'array'
        THEN jsonb_array_length(links) <= 20
        ELSE false
      END
    ),
  completeness_score integer NOT NULL DEFAULT 0
    CHECK (completeness_score BETWEEN 0 AND 100),
  is_default boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_resumes_profile_updated
  ON marie_wedding.resumes(profile_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_one_default_per_profile
  ON marie_wedding.resumes(profile_id)
  WHERE is_default = true AND deleted_at IS NULL;

COMMENT ON TABLE marie_wedding.resumes IS
  '개인 회원의 서버 전용 이력서. profile당 여러 문서를 허용하고, 기본 이력서는 1개만 허용한다.';

-- Every content update advances a monotonic version.  The submit RPC locks the
-- row and records this version together with the immutable snapshot.
CREATE OR REPLACE FUNCTION marie_wedding.touch_resume_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at := clock_timestamp();
  -- last_used_at and is_default are document-list metadata, not submitted
  -- resume content.  Updating only those fields must not make an editor's
  -- optimistic content version stale.
  IF (to_jsonb(NEW) - ARRAY['is_default', 'last_used_at', 'updated_at', 'version']::text[])
       IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['is_default', 'last_used_at', 'updated_at', 'version']::text[]) THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS resumes_touch_version ON marie_wedding.resumes;
CREATE TRIGGER resumes_touch_version
  BEFORE UPDATE ON marie_wedding.resumes
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.touch_resume_version();

-- Serialize every active-resume insertion/default switch for one profile on the
-- parent profile row.  This closes both the five-document count race and the
-- partial-unique-index race when two requests choose a new default together.
CREATE OR REPLACE FUNCTION marie_wedding.prepare_resume_default_and_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_active_count integer;
  v_has_default boolean;
BEGIN
  IF current_setting('marie_wedding.resume_default_context', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'resume_profile_is_immutable' USING ERRCODE = '55000';
  END IF;

  -- A profile-backed row lock is deterministic and shared by INSERT/UPDATE,
  -- including soft deletion.  Locking deletion too prevents a simultaneous
  -- INSERT from observing the old default and leaving the profile with none.
  PERFORM 1
  FROM marie_wedding.profiles AS p
  WHERE p.id = NEW.profile_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume_owner_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Deleted rows do not consume an active slot and cannot be the default.
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.is_default := false;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*), coalesce(bool_or(r.is_default), false)
    INTO v_active_count, v_has_default
    FROM marie_wedding.resumes AS r
    WHERE r.profile_id = NEW.profile_id
      AND r.deleted_at IS NULL;
  ELSE
    SELECT count(*), coalesce(bool_or(r.is_default), false)
    INTO v_active_count, v_has_default
    FROM marie_wedding.resumes AS r
    WHERE r.profile_id = NEW.profile_id
      AND r.deleted_at IS NULL
      AND r.id <> OLD.id;
  END IF;

  IF (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL)
     AND v_active_count >= 5 THEN
    RAISE EXCEPTION 'resume_limit_exceeded' USING ERRCODE = '23514';
  END IF;

  -- The first active document is always the default, regardless of a stale
  -- client-provided false value.
  IF NOT v_has_default THEN
    NEW.is_default := true;
  END IF;

  IF NEW.is_default THEN
    -- Suppress the AFTER-promotion trigger while the old default is cleared;
    -- the outer INSERT/UPDATE is about to install NEW as the replacement.
    PERFORM set_config('marie_wedding.resume_default_context', 'on', true);
    UPDATE marie_wedding.resumes AS r
    SET is_default = false
    WHERE r.profile_id = NEW.profile_id
      AND r.id <> NEW.id
      AND r.is_default = true
      AND r.deleted_at IS NULL;
    PERFORM set_config('marie_wedding.resume_default_context', 'off', true);
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION marie_wedding.prepare_resume_default_and_limit()
  OWNER TO postgres;

DROP TRIGGER IF EXISTS resumes_prepare_default_and_limit
  ON marie_wedding.resumes;
CREATE TRIGGER resumes_prepare_default_and_limit
  BEFORE INSERT OR UPDATE OF profile_id, is_default, deleted_at
  ON marie_wedding.resumes
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.prepare_resume_default_and_limit();

-- Once a former default is inactive or explicitly cleared, promote the most
-- recently edited remaining active document.  The context guard avoids nested
-- promotion when this internal UPDATE fires the same trigger chain.
CREATE OR REPLACE FUNCTION marie_wedding.promote_resume_default_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_candidate_id uuid;
BEGIN
  IF current_setting('marie_wedding.resume_default_context', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF OLD.deleted_at IS NULL
     AND OLD.is_default = true
     AND (NEW.deleted_at IS NOT NULL OR NEW.is_default = false) THEN
    PERFORM 1
    FROM marie_wedding.profiles AS p
    WHERE p.id = OLD.profile_id
    FOR UPDATE;

    SELECT r.id
    INTO v_candidate_id
    FROM marie_wedding.resumes AS r
    WHERE r.profile_id = OLD.profile_id
      AND r.deleted_at IS NULL
    ORDER BY r.updated_at DESC, r.id DESC
    LIMIT 1;

    IF v_candidate_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM marie_wedding.resumes AS current_default
         WHERE current_default.profile_id = OLD.profile_id
           AND current_default.is_default = true
           AND current_default.deleted_at IS NULL
       ) THEN
      PERFORM set_config('marie_wedding.resume_default_context', 'on', true);
      UPDATE marie_wedding.resumes
      SET is_default = true
      WHERE id = v_candidate_id;
      PERFORM set_config('marie_wedding.resume_default_context', 'off', true);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION marie_wedding.promote_resume_default_after_change()
  OWNER TO postgres;

DROP TRIGGER IF EXISTS resumes_promote_default_after_change
  ON marie_wedding.resumes;
CREATE TRIGGER resumes_promote_default_after_change
  AFTER UPDATE OF is_default, deleted_at
  ON marie_wedding.resumes
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.promote_resume_default_after_change();

-- Defense in depth for trusted server code: even service-role mistakes cannot
-- attach a resume to a business, un-onboarded, banned, or deleted profile.
CREATE OR REPLACE FUNCTION marie_wedding.validate_resume_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM marie_wedding.profiles AS p
    WHERE p.id = NEW.profile_id
      AND p.account_type::text = 'individual'
      AND p.onboarded_at IS NOT NULL
      AND p.banned_at IS NULL
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'resume_owner_not_eligible' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION marie_wedding.validate_resume_owner() OWNER TO postgres;

DROP TRIGGER IF EXISTS resumes_validate_owner ON marie_wedding.resumes;
CREATE TRIGGER resumes_validate_owner
  BEFORE INSERT OR UPDATE OF profile_id ON marie_wedding.resumes
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.validate_resume_owner();

-- ---------------------------------------------------------------------------
-- 2. Link applications to their source resume and keep a separate snapshot
-- ---------------------------------------------------------------------------

ALTER TABLE marie_wedding.applications
  ADD COLUMN IF NOT EXISTS resume_id uuid;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'marie_wedding.applications'::regclass
      AND conname = 'applications_resume_id_fkey'
  ) THEN
    ALTER TABLE marie_wedding.applications
      ADD CONSTRAINT applications_resume_id_fkey
      FOREIGN KEY (resume_id)
      REFERENCES marie_wedding.resumes(id)
      ON DELETE SET NULL;
  END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS idx_applications_resume_id
  ON marie_wedding.applications(resume_id)
  WHERE resume_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marie_wedding.application_resume_snapshots (
  application_id uuid PRIMARY KEY
    REFERENCES marie_wedding.applications(id) ON DELETE CASCADE,
  source_resume_id uuid
    REFERENCES marie_wedding.resumes(id) ON DELETE SET NULL,
  source_version integer NOT NULL CHECK (source_version > 0),
  schema_version smallint NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  photo_path text,
  snapshot jsonb NOT NULL
    CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_resume_snapshots_photo_path_length_check
    CHECK (photo_path IS NULL OR char_length(photo_path) <= 1024)
);

-- Keep reapplication safe for databases that ran an earlier revision of this
-- migration before the dedicated server-side cleanup key was introduced.
ALTER TABLE marie_wedding.application_resume_snapshots
  ADD COLUMN IF NOT EXISTS photo_path text;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'marie_wedding.application_resume_snapshots'::regclass
      AND conname = 'application_resume_snapshots_photo_path_length_check'
  ) THEN
    ALTER TABLE marie_wedding.application_resume_snapshots
      ADD CONSTRAINT application_resume_snapshots_photo_path_length_check
      CHECK (photo_path IS NULL OR char_length(photo_path) <= 1024);
  END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS idx_application_resume_snapshots_source
  ON marie_wedding.application_resume_snapshots(source_resume_id)
  WHERE source_resume_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_resume_snapshots_photo_path
  ON marie_wedding.application_resume_snapshots(photo_path)
  WHERE photo_path IS NOT NULL;

COMMENT ON TABLE marie_wedding.application_resume_snapshots IS
  '지원 접수 시점의 이력서 불변 스냅샷. 지원 이후 원본 이력서 수정은 이 내용을 변경하지 않는다.';

CREATE OR REPLACE FUNCTION marie_wedding.prevent_resume_snapshot_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF current_setting('marie_wedding.resume_redaction_context', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'application_resume_snapshot_is_immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS application_resume_snapshot_immutable
  ON marie_wedding.application_resume_snapshots;
CREATE TRIGGER application_resume_snapshot_immutable
  BEFORE UPDATE ON marie_wedding.application_resume_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.prevent_resume_snapshot_update();

-- If trusted code ever writes applications directly, keep the resume owner and
-- applicant owner aligned.  Status-only updates do not execute this trigger.
CREATE OR REPLACE FUNCTION marie_wedding.validate_application_resume_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF NEW.resume_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM marie_wedding.resumes AS r
    WHERE r.id = NEW.resume_id
      AND r.profile_id = NEW.applicant_id
      AND r.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'resume_not_owned_by_applicant' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION marie_wedding.validate_application_resume_owner() OWNER TO postgres;

DROP TRIGGER IF EXISTS applications_validate_resume_owner
  ON marie_wedding.applications;
CREATE TRIGGER applications_validate_resume_owner
  BEFORE INSERT OR UPDATE OF resume_id, applicant_id
  ON marie_wedding.applications
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.validate_application_resume_owner();

-- ---------------------------------------------------------------------------
-- 3. Atomic, authenticated application submission
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION marie_wedding.submit_application_with_resume(
  p_application_id uuid,
  p_job_id uuid,
  p_resume_id uuid,
  p_message text,
  p_contact_phone text DEFAULT NULL
)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_profile marie_wedding.profiles%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
  v_resume marie_wedding.resumes%ROWTYPE;
  v_application marie_wedding.applications%ROWTYPE;
  v_message text := btrim(coalesce(p_message, ''));
  v_contact_phone text;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_application_id IS NULL OR p_job_id IS NULL OR p_resume_id IS NULL THEN
    RAISE EXCEPTION 'invalid_application_request' USING ERRCODE = '22023';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM marie_wedding.profiles AS p
  WHERE p.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Check a completed prior transaction before any mutable job/resume/profile
  -- eligibility rule.  A lost HTTP response must remain retryable with the
  -- same UUID even if the job closed or the source resume changed afterwards.
  SELECT a.*
  INTO v_application
  FROM marie_wedding.applications AS a
  WHERE a.id = p_application_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_application.job_id = p_job_id
       AND v_application.applicant_id = v_profile.id
       AND v_application.resume_id = p_resume_id
       AND v_application.deleted_at IS NULL
       AND EXISTS (
         SELECT 1
         FROM marie_wedding.application_resume_snapshots AS s
         WHERE s.application_id = v_application.id
       ) THEN
      -- The RPC is executable by the applicant's authenticated browser.  A
      -- later idempotent retry must never return the hiring-side private note.
      v_application.author_note := NULL;
      RETURN v_application;
    END IF;
    RAISE EXCEPTION 'application_id_conflict' USING ERRCODE = '23505';
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_profile.account_type::text IS DISTINCT FROM 'individual' THEN
    RAISE EXCEPTION 'individual_account_required' USING ERRCODE = '42501';
  END IF;
  IF v_profile.onboarded_at IS NULL THEN
    RAISE EXCEPTION 'onboarding_required' USING ERRCODE = '42501';
  END IF;
  IF v_profile.banned_at IS NOT NULL THEN
    RAISE EXCEPTION 'account_banned' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_message) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'application_message_length_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT j.*
  INTO v_job
  FROM marie_wedding.jobs AS j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_job.author_id = v_profile.id THEN
    RAISE EXCEPTION 'cannot_apply_to_own_job' USING ERRCODE = '42501';
  END IF;
  IF v_job.hidden_by_admin = true
     OR v_job.status::text NOT IN ('open', 'urgent')
     OR (v_job.deadline IS NOT NULL AND v_job.deadline <= now()) THEN
    RAISE EXCEPTION 'job_closed' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM marie_wedding.profiles AS author_profile
    WHERE author_profile.id = v_job.author_id
      AND author_profile.deleted_at IS NULL
      AND author_profile.banned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'job_author_unavailable' USING ERRCODE = '55000';
  END IF;

  SELECT r.*
  INTO v_resume
  FROM marie_wedding.resumes AS r
  WHERE r.id = p_resume_id
    AND r.profile_id = v_profile.id
    AND r.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF btrim(v_resume.full_name) = '' THEN
    RAISE EXCEPTION 'resume_name_required' USING ERRCODE = '22023';
  END IF;
  IF v_resume.completeness_score < 60 THEN
    RAISE EXCEPTION 'resume_incomplete' USING ERRCODE = '22023';
  END IF;

  v_contact_phone := coalesce(
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(v_resume.phone, '')), '')
  );
  IF v_contact_phone IS NULL
     OR char_length(v_contact_phone) > 40
     OR v_contact_phone !~ '^[0-9+().[:space:]-]+$'
     OR char_length(regexp_replace(v_contact_phone, '[^0-9]', '', 'g'))
        NOT BETWEEN 9 AND 15 THEN
    RAISE EXCEPTION 'contact_phone_required' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM marie_wedding.applications AS existing
    WHERE existing.job_id = p_job_id
      AND existing.applicant_id = v_profile.id
      AND existing.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_applied' USING ERRCODE = '23505';
  END IF;

  BEGIN
    INSERT INTO marie_wedding.applications (
      id,
      job_id,
      applicant_id,
      resume_id,
      message,
      contact_phone
    )
    VALUES (
      p_application_id,
      p_job_id,
      v_profile.id,
      p_resume_id,
      v_message,
      v_contact_phone
    )
    RETURNING * INTO v_application;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_applied' USING ERRCODE = '23505';
  END;

  INSERT INTO marie_wedding.application_resume_snapshots (
    application_id,
    source_resume_id,
    source_version,
    schema_version,
    photo_path,
    snapshot
  )
  VALUES (
    v_application.id,
    v_resume.id,
    v_resume.version,
    1,
    v_resume.photo_path,
    jsonb_build_object(
      'schemaVersion', 1,
      'resumeId', v_resume.id,
      'resumeVersion', v_resume.version,
      'submittedAt', v_application.created_at,
      'completenessScore', v_resume.completeness_score,
      'title', v_resume.title,
      'photoPath', v_resume.photo_path,
      'fullName', v_resume.full_name,
      'email', v_resume.email,
      'phone', v_contact_phone,
      'birthDate', v_resume.birth_date,
      'address', v_resume.address,
      'headline', v_resume.headline,
      'summary', v_resume.summary,
      'desiredRoles', to_jsonb(v_resume.desired_roles),
      'desiredRegions', to_jsonb(v_resume.desired_regions),
      'desiredEmploymentTypes', to_jsonb(v_resume.desired_employment_types),
      'skills', to_jsonb(v_resume.skills),
      'educations', v_resume.educations,
      'experiences', v_resume.experiences,
      'certificates', v_resume.certificates,
      'languages', v_resume.languages,
      'links', v_resume.links
    )
  );

  UPDATE marie_wedding.resumes
  SET last_used_at = v_application.created_at
  WHERE id = v_resume.id;

  v_application.author_note := NULL;
  RETURN v_application;
END;
$function$;

ALTER FUNCTION marie_wedding.submit_application_with_resume(
  uuid, uuid, uuid, text, text
) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 3b. Hiring note privacy at the database boundary
-- ---------------------------------------------------------------------------

-- Row-level security decides which application row a party may read, but it
-- cannot hide one column from the applicant while showing it to the author.
-- Remove table-wide browser SELECT and grant every non-private column instead.
-- Hiring-side reads (including author_note) go through an owner-verified server
-- route, while service_role retains its existing table privilege.
REVOKE SELECT ON TABLE marie_wedding.applications
  FROM PUBLIC, authenticator, anon, authenticated;
REVOKE SELECT (author_note) ON TABLE marie_wedding.applications
  FROM PUBLIC, authenticator, anon, authenticated;

DO $do$
DECLARE
  v_safe_columns text;
BEGIN
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
  INTO v_safe_columns
  FROM pg_catalog.pg_attribute AS a
  WHERE a.attrelid = 'marie_wedding.applications'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname <> 'author_note';

  IF v_safe_columns IS NULL THEN
    RAISE EXCEPTION 'applications_safe_columns_not_found';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON TABLE marie_wedding.applications TO authenticated',
    v_safe_columns
  );
END
$do$;

-- Existing state-machine RPCs return the applications composite type.  Mask
-- author_note when the caller is the applicant so direct PostgREST RPC calls
-- cannot bypass the column privilege above.
CREATE OR REPLACE FUNCTION marie_wedding.set_application_status(
  p_application_id uuid,
  p_status text
)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_caller uuid;
  v_app marie_wedding.applications%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT p.id
  INTO v_caller
  FROM marie_wedding.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.banned_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT a.*
  INTO v_app
  FROM marie_wedding.applications AS a
  WHERE a.id = p_application_id
    AND a.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT j.*
  INTO v_job
  FROM marie_wedding.jobs AS j
  WHERE j.id = v_app.job_id
    AND j.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller = v_job.author_id THEN
    IF p_status NOT IN ('reviewing', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'status_not_allowed_for_author' USING ERRCODE = '22023';
    END IF;
    IF v_app.status::text = 'cancelled' THEN
      RAISE EXCEPTION 'cannot_change_cancelled_application' USING ERRCODE = '55000';
    END IF;
    IF (v_app.hiring_completed_at IS NOT NULL OR v_app.applicant_completed_at IS NOT NULL)
       AND p_status <> v_app.status::text THEN
      RAISE EXCEPTION 'cannot_change_completed_deal' USING ERRCODE = '55000';
    END IF;
  ELSIF v_caller = v_app.applicant_id THEN
    IF p_status <> 'cancelled' THEN
      RAISE EXCEPTION 'status_not_allowed_for_applicant' USING ERRCODE = '22023';
    END IF;
    IF v_app.status::text NOT IN ('pending', 'reviewing') THEN
      RAISE EXCEPTION 'cannot_cancel_final_status' USING ERRCODE = '55000';
    END IF;
  ELSE
    RAISE EXCEPTION 'not_party_to_application' USING ERRCODE = '42501';
  END IF;

  UPDATE marie_wedding.applications
  SET status = p_status
  WHERE id = p_application_id
  RETURNING * INTO v_app;

  IF v_caller = v_app.applicant_id THEN
    v_app.author_note := NULL;
  END IF;
  RETURN v_app;
END;
$function$;

ALTER FUNCTION marie_wedding.set_application_status(uuid, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION marie_wedding.set_application_status(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.set_application_status(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION marie_wedding.mark_deal_completed(
  p_application_id uuid
)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_app marie_wedding.applications%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
  v_caller uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT p.id
  INTO v_caller
  FROM marie_wedding.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.banned_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT a.*
  INTO v_app
  FROM marie_wedding.applications AS a
  WHERE a.id = p_application_id
    AND a.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT j.*
  INTO v_job
  FROM marie_wedding.jobs AS j
  WHERE j.id = v_app.job_id
    AND j.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_app.status::text <> 'accepted' THEN
    RAISE EXCEPTION 'not_accepted' USING ERRCODE = '55000';
  END IF;

  IF v_caller = v_job.author_id THEN
    IF v_app.hiring_completed_at IS NULL THEN
      UPDATE marie_wedding.applications
      SET hiring_completed_at = now()
      WHERE id = p_application_id
      RETURNING * INTO v_app;
    END IF;
  ELSIF v_caller = v_app.applicant_id THEN
    IF v_app.applicant_completed_at IS NULL THEN
      UPDATE marie_wedding.applications
      SET applicant_completed_at = now()
      WHERE id = p_application_id
      RETURNING * INTO v_app;
    END IF;
    v_app.author_note := NULL;
  ELSE
    RAISE EXCEPTION 'not_party_to_application' USING ERRCODE = '42501';
  END IF;

  RETURN v_app;
END;
$function$;

ALTER FUNCTION marie_wedding.mark_deal_completed(uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION marie_wedding.mark_deal_completed(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.mark_deal_completed(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION marie_wedding.set_author_note(
  p_application_id uuid,
  p_note text
)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_caller uuid;
  v_app marie_wedding.applications%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_note) > 5000 THEN
    RAISE EXCEPTION 'author_note_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT p.id
  INTO v_caller
  FROM marie_wedding.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.banned_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT a.*
  INTO v_app
  FROM marie_wedding.applications AS a
  WHERE a.id = p_application_id
    AND a.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM marie_wedding.jobs AS j
    WHERE j.id = v_app.job_id
      AND j.author_id = v_caller
      AND j.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_author' USING ERRCODE = '42501';
  END IF;

  UPDATE marie_wedding.applications
  SET author_note = nullif(v_note, '')
  WHERE id = p_application_id
  RETURNING * INTO v_app;
  RETURN v_app;
END;
$function$;

ALTER FUNCTION marie_wedding.set_author_note(uuid, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION marie_wedding.set_author_note(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.set_author_note(uuid, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Default resume and withdrawal redaction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION marie_wedding.ensure_default_resume()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF NEW.deleted_at IS NULL
     AND NEW.account_type::text = 'individual'
     AND NEW.onboarded_at IS NOT NULL
     AND NEW.banned_at IS NULL THEN
    INSERT INTO marie_wedding.resumes (
      profile_id,
      title,
      full_name,
      phone,
      address,
      desired_regions,
      completeness_score,
      is_default
    )
    SELECT
      NEW.id,
      '기본 이력서',
      coalesce(NEW.contact_name, ''),
      NEW.phone,
      NEW.address,
      CASE
        WHEN NEW.region IS NULL OR btrim(NEW.region) = '' THEN '{}'::text[]
        ELSE ARRAY[NEW.region]
      END,
      (CASE WHEN btrim(coalesce(NEW.contact_name, '')) <> '' THEN 10 ELSE 0 END)
      + (CASE
          WHEN char_length(btrim(coalesce(NEW.phone, ''))) BETWEEN 1 AND 40
           AND btrim(coalesce(NEW.phone, '')) ~ '^[0-9+().[:space:]-]+$'
           AND char_length(regexp_replace(
                 btrim(coalesce(NEW.phone, '')), '[^0-9]', '', 'g'
               )) BETWEEN 9 AND 15
          THEN 10
          ELSE 0
        END),
      true
    WHERE NOT EXISTS (
      SELECT 1
      FROM marie_wedding.resumes AS r
      WHERE r.profile_id = NEW.id
        AND r.deleted_at IS NULL
    )
    ON CONFLICT (profile_id)
      WHERE is_default = true AND deleted_at IS NULL
      DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION marie_wedding.ensure_default_resume() OWNER TO postgres;

DROP TRIGGER IF EXISTS profiles_create_default_resume_insert
  ON marie_wedding.profiles;
CREATE TRIGGER profiles_create_default_resume_insert
  AFTER INSERT ON marie_wedding.profiles
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.ensure_default_resume();

DROP TRIGGER IF EXISTS profiles_create_default_resume_update
  ON marie_wedding.profiles;
CREATE TRIGGER profiles_create_default_resume_update
  AFTER UPDATE OF account_type, onboarded_at, deleted_at, banned_at
  ON marie_wedding.profiles
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.ensure_default_resume();

CREATE OR REPLACE FUNCTION marie_wedding.redact_resume_data_on_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_redacted_at timestamptz := clock_timestamp();
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- The profile UPDATE already owns the same profile-row lock used by resume
    -- default management.  Suppress per-row default preparation and promotion
    -- while every document is being redacted in this one statement; otherwise
    -- an AFTER trigger could nested-update another tuple still owned by this
    -- outer multi-row UPDATE.
    PERFORM set_config('marie_wedding.resume_default_context', 'on', true);
    UPDATE marie_wedding.resumes
    SET title = '삭제된 이력서',
        full_name = '탈퇴한 회원',
        email = NULL,
        phone = NULL,
        birth_date = NULL,
        address = NULL,
        photo_path = NULL,
        headline = NULL,
        summary = NULL,
        desired_roles = '{}'::text[],
        desired_regions = '{}'::text[],
        desired_employment_types = '{}'::text[],
        skills = '{}'::text[],
        educations = '[]'::jsonb,
        experiences = '[]'::jsonb,
        certificates = '[]'::jsonb,
        languages = '[]'::jsonb,
        links = '[]'::jsonb,
        completeness_score = 0,
        last_used_at = NULL,
        is_default = false,
        deleted_at = coalesce(deleted_at, v_redacted_at)
    WHERE profile_id = NEW.id;
    PERFORM set_config('marie_wedding.resume_default_context', 'off', true);

    -- The snapshot row is retained only as a non-PII audit marker.  This keeps
    -- historical application/review foreign keys intact without retaining the
    -- withdrawn member's resume contents.
    PERFORM set_config('marie_wedding.resume_redaction_context', 'on', true);

    UPDATE marie_wedding.application_resume_snapshots AS s
    SET source_resume_id = NULL,
        photo_path = NULL,
        snapshot = jsonb_build_object(
          'schemaVersion', s.schema_version,
          'redacted', true,
          'title', '삭제된 이력서',
          'redactedAt', v_redacted_at
        )
    FROM marie_wedding.applications AS a
    WHERE a.id = s.application_id
      AND a.applicant_id = NEW.id;

    UPDATE marie_wedding.applications
    SET resume_id = NULL
    WHERE applicant_id = NEW.id
      AND resume_id IS NOT NULL;

    PERFORM set_config('marie_wedding.resume_redaction_context', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION marie_wedding.redact_resume_data_on_profile_delete()
  OWNER TO postgres;

DROP TRIGGER IF EXISTS profiles_redact_resume_data
  ON marie_wedding.profiles;
CREATE TRIGGER profiles_redact_resume_data
  AFTER UPDATE OF deleted_at ON marie_wedding.profiles
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.redact_resume_data_on_profile_delete();

-- Existing eligible individuals receive one default document.  Re-running the
-- release migration is harmless because the partial unique index is the final
-- concurrency guard.
INSERT INTO marie_wedding.resumes (
  profile_id,
  title,
  full_name,
  phone,
  address,
  desired_regions,
  completeness_score,
  is_default
)
SELECT
  p.id,
  '기본 이력서',
  coalesce(p.contact_name, ''),
  p.phone,
  p.address,
  CASE
    WHEN p.region IS NULL OR btrim(p.region) = '' THEN '{}'::text[]
    ELSE ARRAY[p.region]
  END,
  (CASE WHEN btrim(coalesce(p.contact_name, '')) <> '' THEN 10 ELSE 0 END)
  + (CASE
      WHEN char_length(btrim(coalesce(p.phone, ''))) BETWEEN 1 AND 40
       AND btrim(coalesce(p.phone, '')) ~ '^[0-9+().[:space:]-]+$'
       AND char_length(regexp_replace(
             btrim(coalesce(p.phone, '')), '[^0-9]', '', 'g'
           )) BETWEEN 9 AND 15
      THEN 10
      ELSE 0
    END),
  true
FROM marie_wedding.profiles AS p
WHERE p.account_type::text = 'individual'
  AND p.onboarded_at IS NOT NULL
  AND p.banned_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM marie_wedding.resumes AS r
    WHERE r.profile_id = p.id
      AND r.deleted_at IS NULL
  )
ON CONFLICT (profile_id)
  WHERE is_default = true AND deleted_at IS NULL
  DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Private Storage bucket and explicit least-privilege grants
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'resume-files',
  'resume-files',
  false,
  10 * 1024 * 1024,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE marie_wedding.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.application_resume_snapshots ENABLE ROW LEVEL SECURITY;

-- schema.sql grants broad default table privileges.  These two PII-bearing
-- tables deliberately have no browser RLS policy and no browser table grant;
-- verified server routes and the guarded submit RPC are their only entry points.
REVOKE ALL ON TABLE marie_wedding.resumes
  FROM PUBLIC, authenticator, anon, authenticated;
REVOKE ALL ON TABLE marie_wedding.application_resume_snapshots
  FROM PUBLIC, authenticator, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE marie_wedding.resumes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE marie_wedding.application_resume_snapshots TO service_role;

-- Adding a column after an older security migration must never reopen a direct
-- application write path through a stale column-level grant.
REVOKE INSERT (resume_id), UPDATE (resume_id), REFERENCES (resume_id)
  ON TABLE marie_wedding.applications
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION marie_wedding.touch_resume_version()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION marie_wedding.prepare_resume_default_and_limit()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION marie_wedding.promote_resume_default_after_change()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION marie_wedding.validate_resume_owner()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION marie_wedding.prevent_resume_snapshot_update()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION marie_wedding.validate_application_resume_owner()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION marie_wedding.ensure_default_resume()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION marie_wedding.redact_resume_data_on_profile_delete()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION marie_wedding.submit_application_with_resume(
  uuid, uuid, uuid, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION marie_wedding.submit_application_with_resume(
  uuid, uuid, uuid, text, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
