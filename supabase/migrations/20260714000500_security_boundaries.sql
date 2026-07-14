-- Final security boundary: close direct-write and SECURITY DEFINER privilege gaps
-- by row-level policies alone.  The B2B tables were retired on 2026-06-16,
-- but every related block is conditional so this migration also hardens an
-- older deployment that still has those objects without recreating them.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Profile ownership: keep user_id private without breaking RLS policies.
-- ---------------------------------------------------------------------------

-- Browser roles intentionally cannot SELECT profiles.user_id.  RLS policies
-- must therefore not join profiles on that private column as the invoking
-- role.  This no-argument helper exposes only the active profile id belonging
-- to the JWT subject and performs that lookup with the function owner's table
-- privileges.  A fixed, catalog-only search_path prevents object shadowing.
CREATE OR REPLACE FUNCTION marie_wedding.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
  SELECT p.id
  FROM marie_wedding.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.deleted_at IS NULL
  ORDER BY p.id
  LIMIT 1
$function$;

ALTER FUNCTION marie_wedding.current_profile_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION marie_wedding.current_profile_id()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marie_wedding.current_profile_id()
  TO anon, authenticated, service_role;

-- Account creation, deletion, and restoration are server workflows.  Remove
-- both table- and column-level grants because either can exist independently.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE marie_wedding.profiles
  FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  v_all_columns text;
  v_policy record;
BEGIN
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_all_columns
  FROM pg_attribute a
  WHERE a.attrelid = 'marie_wedding.profiles'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_all_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE INSERT (%s), REFERENCES (%s) ON TABLE marie_wedding.profiles FROM PUBLIC, anon, authenticated',
      v_all_columns,
      v_all_columns
    );
  END IF;

  -- RLS is not used as an alternate browser insertion/deletion entry point.
  -- service_role and table owners bypass these policies for trusted flows.
  FOR v_policy IN
    SELECT pol.polname
    FROM pg_policy pol
    WHERE pol.polrelid = 'marie_wedding.profiles'::regclass
      AND pol.polcmd IN ('a', 'd')
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON marie_wedding.profiles',
      v_policy.polname
    );
  END LOOP;
END
$do$;

-- Rewrite every surviving product policy that previously selected
-- profiles.user_id.  ALTER POLICY preserves its command, roles, permissive
-- mode, and comment while changing only the ownership predicates.  Entries
-- are conditional so this remains safe across partially upgraded installs.
DO $do$
DECLARE
  v_policy record;
  v_sql text;
BEGIN
  FOR v_policy IN
    SELECT *
    FROM (VALUES
      -- Core profile/content policies.
      ('marie_wedding', 'profiles', 'profiles_update',
       $expr$id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$,
       $expr$id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$),
      ('marie_wedding', 'jobs', 'jobs_insert', NULL::text,
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) AND (SELECT marie_wedding.is_onboarded())$expr$),
      ('marie_wedding', 'jobs', 'jobs_insert_own', NULL::text,
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) AND (SELECT marie_wedding.is_onboarded())$expr$),
      ('marie_wedding', 'jobs', 'jobs_update',
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$, NULL::text),
      ('marie_wedding', 'posts', 'posts_insert', NULL::text,
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) AND (SELECT marie_wedding.is_onboarded())$expr$),
      ('marie_wedding', 'posts', 'posts_insert_own', NULL::text,
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) AND (SELECT marie_wedding.is_onboarded())$expr$),
      ('marie_wedding', 'posts', 'posts_update',
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$, NULL::text),
      ('marie_wedding', 'comments', 'comments_insert', NULL::text,
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) AND (SELECT marie_wedding.is_onboarded())$expr$),
      ('marie_wedding', 'comments', 'comments_insert_own', NULL::text,
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) AND (SELECT marie_wedding.is_onboarded())$expr$),
      ('marie_wedding', 'comments', 'comments_update',
       $expr$author_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$, NULL::text),
      ('marie_wedding', 'post_likes', 'post_likes_insert_own', NULL::text,
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'post_likes', 'post_likes_delete_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),

      -- Applications retain the final account-type and self-application
      -- guards while no longer reading the private user_id column.
      ('marie_wedding', 'applications', 'applications_select_related',
       $expr$
         (SELECT marie_wedding.is_admin())
         OR applicant_id = (SELECT marie_wedding.current_profile_id())
         OR job_id IN (
           SELECT j.id FROM marie_wedding.jobs AS j
           WHERE j.author_id = (SELECT marie_wedding.current_profile_id())
         )
       $expr$, NULL::text),
      ('marie_wedding', 'applications', 'applications_insert_own', NULL::text,
       $expr$
         applicant_id = (SELECT marie_wedding.current_profile_id())
         AND EXISTS (
           SELECT 1 FROM marie_wedding.profiles AS p
           WHERE p.id = (SELECT marie_wedding.current_profile_id())
             AND p.deleted_at IS NULL
             AND p.account_type = 'individual'
         )
         AND NOT EXISTS (
           SELECT 1 FROM marie_wedding.jobs AS j
           WHERE j.id = applications.job_id
             AND j.author_id = (SELECT marie_wedding.current_profile_id())
         )
       $expr$),
      ('marie_wedding', 'applications', 'applications_update_related',
       $expr$
         (SELECT marie_wedding.is_admin())
         OR applicant_id = (SELECT marie_wedding.current_profile_id())
         OR job_id IN (
           SELECT j.id FROM marie_wedding.jobs AS j
           WHERE j.author_id = (SELECT marie_wedding.current_profile_id())
         )
       $expr$,
       $expr$
         (SELECT marie_wedding.is_admin())
         OR applicant_id = (SELECT marie_wedding.current_profile_id())
         OR job_id IN (
           SELECT j.id FROM marie_wedding.jobs AS j
           WHERE j.author_id = (SELECT marie_wedding.current_profile_id())
         )
       $expr$),

      -- Private user collections.
      ('marie_wedding', 'bookmarks', 'bookmarks_select_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),
      ('marie_wedding', 'bookmarks', 'bookmarks_insert_own', NULL::text,
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'bookmarks', 'bookmarks_delete_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),
      ('marie_wedding', 'notifications', 'notifications_select_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),
      ('marie_wedding', 'notifications', 'notifications_update_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$,
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'reports', 'reports_insert_own', NULL::text,
       $expr$reporter_id IS NULL OR reporter_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'reports', 'reports_select_related',
       $expr$(SELECT marie_wedding.is_admin()) OR reporter_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),
      ('marie_wedding', 'saved_searches', 'saved_searches_select_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),
      ('marie_wedding', 'saved_searches', 'saved_searches_insert_own', NULL::text,
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'saved_searches', 'saved_searches_delete_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),

      -- Availability, messaging, trust, and payments.
      ('marie_wedding', 'availability_slots', 'availability_write_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$,
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'availability_slots', 'availability_select_own',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),
      ('marie_wedding', 'conversations', 'conversations_select_participant',
       $expr$
         participant_a = (SELECT marie_wedding.current_profile_id())
         OR participant_b = (SELECT marie_wedding.current_profile_id())
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'messages', 'messages_select_participant',
       $expr$
         conversation_id IN (
           SELECT c.id FROM marie_wedding.conversations AS c
           WHERE c.participant_a = (SELECT marie_wedding.current_profile_id())
              OR c.participant_b = (SELECT marie_wedding.current_profile_id())
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'messages', 'messages_update_read',
       $expr$
         conversation_id IN (
           SELECT c.id FROM marie_wedding.conversations AS c
           WHERE c.participant_a = (SELECT marie_wedding.current_profile_id())
              OR c.participant_b = (SELECT marie_wedding.current_profile_id())
         )
       $expr$, NULL::text),
      ('marie_wedding', 'portfolios', 'portfolios_insert', NULL::text,
       $expr$profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'portfolios', 'portfolios_update',
       $expr$profile_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$, NULL::text),
      ('marie_wedding', 'reviews', 'reviews_select',
       $expr$
         (is_public = true AND is_hidden_by_admin = false AND deleted_at IS NULL)
         OR (SELECT marie_wedding.is_admin())
         OR reviewer_id = (SELECT marie_wedding.current_profile_id())
         OR reviewee_id = (SELECT marie_wedding.current_profile_id())
       $expr$, NULL::text),
      ('marie_wedding', 'payments', 'payments_select_own',
       $expr$(SELECT marie_wedding.is_admin()) OR profile_id = (SELECT marie_wedding.current_profile_id())$expr$, NULL::text),

      -- Storage policy ownership uses the same opaque profile id.
      ('storage', 'objects', 'portfolios_storage_insert', NULL::text,
       $expr$
         bucket_id = 'portfolios'
         AND (storage.foldername(name))[1] = (SELECT marie_wedding.current_profile_id())::text
       $expr$),
      ('storage', 'objects', 'portfolios_storage_delete',
       $expr$
         bucket_id = 'portfolios'
         AND (storage.foldername(name))[1] = (SELECT marie_wedding.current_profile_id())::text
       $expr$, NULL::text),

      -- Retired 2026-06-16 B2B objects are conditional for older installs.
      ('marie_wedding', 'organizations', 'org_select',
       $expr$
         owner_profile_id = (SELECT marie_wedding.current_profile_id())
         OR id IN (
           SELECT m.organization_id
           FROM marie_wedding.organization_members AS m
           WHERE m.member_profile_id = (SELECT marie_wedding.current_profile_id())
             AND m.deleted_at IS NULL
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'organizations', 'org_insert', NULL::text,
       $expr$owner_profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'organizations', 'org_update',
       $expr$owner_profile_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$, NULL::text),
      ('marie_wedding', 'organization_members', 'org_members_select',
       $expr$
         member_profile_id = (SELECT marie_wedding.current_profile_id())
         OR organization_id IN (
           SELECT o.id FROM marie_wedding.organizations AS o
           WHERE o.owner_profile_id = (SELECT marie_wedding.current_profile_id())
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'organization_members', 'org_members_insert', NULL::text,
       $expr$
         organization_id IN (
           SELECT o.id FROM marie_wedding.organizations AS o
           WHERE o.owner_profile_id = (SELECT marie_wedding.current_profile_id())
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$),
      ('marie_wedding', 'organization_members', 'org_members_update',
       $expr$
         organization_id IN (
           SELECT o.id FROM marie_wedding.organizations AS o
           WHERE o.owner_profile_id = (SELECT marie_wedding.current_profile_id())
         )
         OR member_profile_id = (SELECT marie_wedding.current_profile_id())
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'quotations', 'quotations_select',
       $expr$
         sender_profile_id = (SELECT marie_wedding.current_profile_id())
         OR receiver_profile_id = (SELECT marie_wedding.current_profile_id())
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'quotations', 'quotations_insert', NULL::text,
       $expr$sender_profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'quotations', 'quotations_update',
       $expr$
         sender_profile_id = (SELECT marie_wedding.current_profile_id())
         OR receiver_profile_id = (SELECT marie_wedding.current_profile_id())
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'quotation_items', 'quotation_items_select',
       $expr$
         quotation_id IN (
           SELECT q.id FROM marie_wedding.quotations AS q
           WHERE q.sender_profile_id = (SELECT marie_wedding.current_profile_id())
              OR q.receiver_profile_id = (SELECT marie_wedding.current_profile_id())
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'quotation_items', 'quotation_items_modify',
       $expr$
         quotation_id IN (
           SELECT q.id FROM marie_wedding.quotations AS q
           WHERE q.sender_profile_id = (SELECT marie_wedding.current_profile_id())
             AND q.status = 'draft'
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$,
       $expr$
         quotation_id IN (
           SELECT q.id FROM marie_wedding.quotations AS q
           WHERE q.sender_profile_id = (SELECT marie_wedding.current_profile_id())
             AND q.status = 'draft'
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$),
      ('marie_wedding', 'contracts', 'contracts_select',
       $expr$
         party_a_profile_id = (SELECT marie_wedding.current_profile_id())
         OR party_b_profile_id = (SELECT marie_wedding.current_profile_id())
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'contracts', 'contracts_insert', NULL::text,
       $expr$
         party_a_profile_id = (SELECT marie_wedding.current_profile_id())
         OR party_b_profile_id = (SELECT marie_wedding.current_profile_id())
       $expr$),
      ('marie_wedding', 'contracts', 'contracts_update',
       $expr$
         party_a_profile_id = (SELECT marie_wedding.current_profile_id())
         OR party_b_profile_id = (SELECT marie_wedding.current_profile_id())
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'contract_signatures', 'contract_sig_select',
       $expr$
         contract_id IN (
           SELECT c.id FROM marie_wedding.contracts AS c
           WHERE c.party_a_profile_id = (SELECT marie_wedding.current_profile_id())
              OR c.party_b_profile_id = (SELECT marie_wedding.current_profile_id())
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'contract_signatures', 'contract_sig_insert', NULL::text,
       $expr$signer_profile_id = (SELECT marie_wedding.current_profile_id())$expr$),
      ('marie_wedding', 'bookings', 'bookings_select',
       $expr$
         provider_profile_id = (SELECT marie_wedding.current_profile_id())
         OR contract_id IN (
           SELECT c.id FROM marie_wedding.contracts AS c
           WHERE c.party_a_profile_id = (SELECT marie_wedding.current_profile_id())
              OR c.party_b_profile_id = (SELECT marie_wedding.current_profile_id())
         )
         OR (SELECT marie_wedding.is_admin())
       $expr$, NULL::text),
      ('marie_wedding', 'bookings', 'bookings_modify',
       $expr$provider_profile_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$,
       $expr$provider_profile_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$),
      ('marie_wedding', 'settlements', 'settlements_select',
       $expr$payee_profile_id = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$, NULL::text),
      ('marie_wedding', 'audit_log', 'audit_log_select',
       $expr$changed_by = (SELECT marie_wedding.current_profile_id()) OR (SELECT marie_wedding.is_admin())$expr$, NULL::text)
    ) AS policies(schema_name, table_name, policy_name, using_expr, check_expr)
  LOOP
    IF to_regclass(format('%I.%I', v_policy.schema_name, v_policy.table_name)) IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM pg_policy pol
         JOIN pg_class cls ON cls.oid = pol.polrelid
         JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
         WHERE nsp.nspname = v_policy.schema_name
           AND cls.relname = v_policy.table_name
           AND pol.polname = v_policy.policy_name
       ) THEN
      CONTINUE;
    END IF;

    v_sql := format(
      'ALTER POLICY %I ON %I.%I',
      v_policy.policy_name,
      v_policy.schema_name,
      v_policy.table_name
    );
    IF v_policy.using_expr IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_policy.using_expr);
    END IF;
    IF v_policy.check_expr IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_policy.check_expr);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END
$do$;

-- Fail closed if a policy was added under an unexpected name and still reads
-- profiles.user_id.  Catalog dependencies are used instead of fragile text
-- matching, so aliases and formatter differences cannot bypass this check.
DO $do$
DECLARE
  v_remaining_policies text;
  v_user_id_attnum smallint;
BEGIN
  SELECT a.attnum
    INTO v_user_id_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'marie_wedding.profiles'::regclass
    AND a.attname = 'user_id'
    AND NOT a.attisdropped;

  SELECT string_agg(
           format('%I.%I.%I', nsp.nspname, cls.relname, pol.polname),
           ', ' ORDER BY nsp.nspname, cls.relname, pol.polname
         )
    INTO v_remaining_policies
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
  JOIN pg_depend dep
    ON dep.classid = 'pg_policy'::regclass
   AND dep.objid = pol.oid
   AND dep.refclassid = 'pg_class'::regclass
   AND dep.refobjid = 'marie_wedding.profiles'::regclass
   AND dep.refobjsubid = v_user_id_attnum;

  IF v_remaining_policies IS NOT NULL THEN
    RAISE EXCEPTION 'policies_still_reference_private_profiles_user_id: %',
      v_remaining_policies
      USING ERRCODE = '42501';
  END IF;
END
$do$;

-- Apply the public profile projection only after every dependent policy has
-- been rewritten and verified.  Keeping this in the same transaction means a
-- failed rewrite cannot leave authenticated requests unable to evaluate RLS.
REVOKE SELECT ON TABLE marie_wedding.profiles
  FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  v_all_columns text;
  v_public_columns text;
BEGIN
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_all_columns
  FROM pg_attribute a
  WHERE a.attrelid = 'marie_wedding.profiles'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_all_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT (%s) ON TABLE marie_wedding.profiles FROM PUBLIC, anon, authenticated',
      v_all_columns
    );
  END IF;

  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_public_columns
  FROM pg_attribute a
  WHERE a.attrelid = 'marie_wedding.profiles'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname = ANY (ARRAY[
      'id',
      'account_type',
      'business_type',
      'company_name',
      'contact_name',
      'region',
      'bio',
      'website',
      'profile_image',
      'cover_image',
      'is_directory_listed',
      'company_size',
      'established_year',
      'address',
      'gallery',
      'created_at',
      'updated_at',
      'deleted_at',
      'verification_status',
      'verified_at',
      'phone_verified',
      'response_rate',
      'avg_response_minutes',
      'completed_deals_count',
      'premium_tier',
      'featured_at',
      'featured_order'
    ]::text[]);

  IF v_public_columns IS NOT NULL THEN
    EXECUTE format(
      'GRANT SELECT (%s) ON TABLE marie_wedding.profiles TO anon, authenticated',
      v_public_columns
    );
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 2. profiles: browser sessions may update presentation fields only.
-- ---------------------------------------------------------------------------

-- A table-level REVOKE does not remove an independently granted column
-- privilege.  Remove both forms first, then add back the explicit allow-list.
REVOKE UPDATE ON TABLE marie_wedding.profiles
  FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  v_all_columns text;
  v_editable_columns text;
BEGIN
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_all_columns
  FROM pg_attribute a
  WHERE a.attrelid = 'marie_wedding.profiles'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_all_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE UPDATE (%s) ON TABLE marie_wedding.profiles FROM PUBLIC, anon, authenticated',
      v_all_columns
    );
  END IF;

  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_editable_columns
  FROM pg_attribute a
  WHERE a.attrelid = 'marie_wedding.profiles'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname = ANY (ARRAY[
      'business_type',
      'company_name',
      'contact_name',
      'region',
      'bio',
      'phone',
      'website',
      'profile_image',
      'cover_image',
      'is_directory_listed',
      'company_size',
      'established_year',
      'address',
      'gallery'
    ]::text[]);

  IF v_editable_columns IS NOT NULL THEN
    EXECUTE format(
      'GRANT UPDATE (%s) ON TABLE marie_wedding.profiles TO authenticated',
      v_editable_columns
    );
  END IF;
END
$do$;

-- Default-deny future profile columns as well.  Even if a broad table grant is
-- accidentally restored later, a normal user can change only this allow-list.
-- Changing the phone number atomically clears its verification trust fields.
CREATE OR REPLACE FUNCTION marie_wedding.protect_profile_admin_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_phone_changed boolean;
  v_forbidden_columns text[];
BEGIN
  IF auth.role() = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin')
     OR marie_wedding.is_admin()
     OR current_setting('marie_wedding.system_context', true) = 'on' THEN
    RETURN NEW;
  END IF;

  v_phone_changed := NEW.phone IS DISTINCT FROM OLD.phone;
  IF v_phone_changed THEN
    NEW.phone_verified := false;
    NEW.phone_verified_at := NULL;
  END IF;

  SELECT array_agg(n.key ORDER BY n.key)
    INTO v_forbidden_columns
  FROM jsonb_each(to_jsonb(NEW)) AS n(key, value)
  WHERE to_jsonb(OLD) -> n.key IS DISTINCT FROM n.value
    AND NOT (n.key = ANY (ARRAY[
      'business_type',
      'company_name',
      'contact_name',
      'region',
      'bio',
      'phone',
      'website',
      'profile_image',
      'cover_image',
      'is_directory_listed',
      'company_size',
      'established_year',
      'address',
      'gallery',
      -- profiles_updated_at is another BEFORE trigger and may run first.
      'updated_at'
    ]::text[]))
    AND NOT (
      v_phone_changed
      AND n.key = ANY (ARRAY['phone_verified', 'phone_verified_at']::text[])
      AND (
        (n.key = 'phone_verified' AND n.value = 'false'::jsonb)
        OR (n.key = 'phone_verified_at' AND n.value = 'null'::jsonb)
      )
    );

  IF v_forbidden_columns IS NOT NULL THEN
    RAISE EXCEPTION 'protected_profile_columns_modified: %',
      array_to_string(v_forbidden_columns, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_profile_admin_cols ON marie_wedding.profiles;
CREATE TRIGGER protect_profile_admin_cols
  BEFORE UPDATE ON marie_wedding.profiles
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.protect_profile_admin_cols();

REVOKE ALL ON FUNCTION marie_wedding.protect_profile_admin_cols()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marie_wedding.protect_profile_admin_cols()
  TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Core content writes: trusted API routes own state transitions.
-- ---------------------------------------------------------------------------

-- jobs/posts/applications contain promotion, moderation, notice, ownership,
-- ranking, and guarded workflow-state columns.  All product writes now pass
-- through verified service-role API routes or guarded SECURITY DEFINER RPCs,
-- so browser roles need SELECT only.  comments retain only the one direct
-- soft-delete column used by the current client.
DO $do$
DECLARE
  v_table_name text;
  v_all_columns text;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['jobs', 'posts', 'applications']::text[] LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE marie_wedding.%I FROM PUBLIC, anon, authenticated',
      v_table_name
    );
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
      INTO v_all_columns
    FROM pg_attribute a
    WHERE a.attrelid = format('marie_wedding.%I', v_table_name)::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF v_all_columns IS NOT NULL THEN
      EXECUTE format(
        'REVOKE INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON TABLE marie_wedding.%2$I FROM PUBLIC, anon, authenticated',
        v_all_columns,
        v_table_name
      );
    END IF;
  END LOOP;

  EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE marie_wedding.comments FROM PUBLIC, anon, authenticated';
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_all_columns
  FROM pg_attribute a
  WHERE a.attrelid = 'marie_wedding.comments'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF v_all_columns IS NOT NULL THEN
    EXECUTE format(
      'REVOKE INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON TABLE marie_wedding.comments FROM PUBLIC, anon, authenticated',
      v_all_columns
    );
  END IF;
  EXECUTE 'GRANT UPDATE (deleted_at) ON TABLE marie_wedding.comments TO authenticated';
END
$do$;

-- ---------------------------------------------------------------------------
-- 4. Storage: reject client-bypass uploads larger than optimized assets.
-- ---------------------------------------------------------------------------

-- 모든 현행 이미지 경로는 브라우저에서 1MB 안팎으로 최적화하거나 관리자 API가
-- 2MB로 제한한다. 과거 50MB 완화값을 유지하면 클라이언트를 우회한 대용량 업로드가
-- 가능하므로 Storage 자체도 동일한 방어선을 둔다.
DO $do$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid = 'storage.buckets'::regclass
         AND attname = 'file_size_limit'
         AND NOT attisdropped
     )
     AND EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid = 'storage.buckets'::regclass
         AND attname = 'allowed_mime_types'
         AND NOT attisdropped
     ) THEN
    UPDATE storage.buckets
    SET file_size_limit = 2 * 1024 * 1024,
        allowed_mime_types = ARRAY[
          'image/jpeg',
          'image/png',
          'image/webp'
        ]::text[]
    WHERE id IN ('avatars', 'job-images', 'event-images', 'portfolios');
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 5. job_view_dedup: viewer fingerprints are internal implementation data.
-- ---------------------------------------------------------------------------

DO $do$
DECLARE
  v_policy record;
BEGIN
  IF to_regclass('marie_wedding.job_view_dedup') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE marie_wedding.job_view_dedup ENABLE ROW LEVEL SECURITY';

  -- No browser-facing policy is needed: increment_job_view_count is the only
  -- write path and is a guarded SECURITY DEFINER function.
  FOR v_policy IN
    SELECT pol.polname
    FROM pg_policy pol
    WHERE pol.polrelid = 'marie_wedding.job_view_dedup'::regclass
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON marie_wedding.job_view_dedup',
      v_policy.polname
    );
  END LOOP;

  EXECUTE 'REVOKE ALL ON TABLE marie_wedding.job_view_dedup FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marie_wedding.job_view_dedup TO service_role';
END
$do$;

-- ---------------------------------------------------------------------------
-- 6. Retired B2B tables: no direct state-machine writes from browser roles.
-- ---------------------------------------------------------------------------

DO $do$
DECLARE
  v_table_name text;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'quotations',
    'contracts',
    'contract_signatures',
    'bookings'
  ]::text[] LOOP
    IF to_regclass(format('marie_wedding.%I', v_table_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE ON TABLE marie_wedding.%I FROM PUBLIC, anon, authenticated',
        v_table_name
      );
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marie_wedding.%I TO service_role',
        v_table_name
      );
    END IF;
  END LOOP;
END
$do$;

-- Preserve the authenticated RPC state-machine paths while removing the
-- default PUBLIC execute grant.  pg_get_function_identity_arguments keeps the
-- operation safe if an overloaded function exists.
DO $do$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'marie_wedding'
      AND p.prokind = 'f'
      AND p.proname = ANY (ARRAY[
        'transition_quotation_status',
        'create_contract_from_quotation',
        'sign_contract',
        'cancel_contract',
        'mark_contract_in_progress',
        'complete_contract',
        'create_booking_from_contract',
        'create_booking_safe',
        'update_booking_status',
        'update_booking_time'
      ]::text[])
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
  END LOOP;
END
$do$;

-- A signature row must identify the actual party represented by signer_side.
-- This invariant also applies to trusted server writes, while the caller/self
-- check is bypassed only for service-role and database administrators.
DO $do$
BEGIN
  IF to_regclass('marie_wedding.contract_signatures') IS NULL
     OR to_regclass('marie_wedding.contracts') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.enforce_contract_signature_party()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_party_a uuid;
      v_party_b uuid;
      v_expected_signer uuid;
      v_caller uuid;
    BEGIN
      IF TG_OP = 'UPDATE'
         AND (
           NEW.contract_id IS DISTINCT FROM OLD.contract_id
           OR NEW.signer_profile_id IS DISTINCT FROM OLD.signer_profile_id
           OR NEW.signer_side IS DISTINCT FROM OLD.signer_side
           OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
         ) THEN
        RAISE EXCEPTION 'contract_signature_is_immutable'
          USING ERRCODE = '23514';
      END IF;

      SELECT c.party_a_profile_id, c.party_b_profile_id
        INTO v_party_a, v_party_b
      FROM marie_wedding.contracts c
      WHERE c.id = NEW.contract_id
        AND c.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'contract_not_found'
          USING ERRCODE = '23503';
      END IF;

      IF NEW.signer_side = 'party_a' THEN
        v_expected_signer := v_party_a;
      ELSIF NEW.signer_side = 'party_b' THEN
        v_expected_signer := v_party_b;
      ELSE
        RAISE EXCEPTION 'invalid_signer_side'
          USING ERRCODE = '23514';
      END IF;

      IF NEW.signer_profile_id IS DISTINCT FROM v_expected_signer THEN
        RAISE EXCEPTION 'signer_does_not_match_contract_party'
          USING ERRCODE = '23514';
      END IF;

      IF auth.role() IS DISTINCT FROM 'service_role'
         AND session_user NOT IN ('postgres', 'supabase_admin')
         AND NOT marie_wedding.is_admin() THEN
        SELECT p.id
          INTO v_caller
        FROM marie_wedding.profiles p
        WHERE p.user_id = auth.uid()
          AND p.deleted_at IS NULL;

        IF v_caller IS DISTINCT FROM NEW.signer_profile_id THEN
          RAISE EXCEPTION 'signer_must_be_caller'
            USING ERRCODE = '42501';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $function$;
  $ddl$;

  EXECUTE 'DROP TRIGGER IF EXISTS enforce_contract_signature_party ON marie_wedding.contract_signatures';
  EXECUTE $ddl$
    CREATE TRIGGER enforce_contract_signature_party
      BEFORE INSERT OR UPDATE ON marie_wedding.contract_signatures
      FOR EACH ROW
      EXECUTE FUNCTION marie_wedding.enforce_contract_signature_party()
  $ddl$;

  EXECUTE 'REVOKE ALL ON FUNCTION marie_wedding.enforce_contract_signature_party() FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION marie_wedding.enforce_contract_signature_party() TO service_role';
END
$do$;

-- ---------------------------------------------------------------------------
-- 7. Booking detail RPCs: only the calendar owner/admin/server may inspect it.
-- ---------------------------------------------------------------------------

DO $do$
BEGIN
  IF to_regprocedure(
       'marie_wedding.check_booking_conflict(uuid,date,time without time zone,time without time zone,uuid)'
     ) IS NULL
     OR to_regclass('marie_wedding.bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.check_booking_conflict(
      p_provider_profile_id uuid,
      p_event_date date,
      p_start_time time DEFAULT NULL,
      p_end_time time DEFAULT NULL,
      p_exclude_booking_id uuid DEFAULT NULL
    )
    RETURNS TABLE (
      id uuid,
      contract_id uuid,
      start_time time,
      end_time time,
      status text,
      is_all_day boolean
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_caller uuid;
    BEGIN
      IF p_provider_profile_id IS NULL OR p_event_date IS NULL THEN
        RAISE EXCEPTION 'invalid_booking_scope';
      END IF;
      IF p_start_time IS NOT NULL
         AND p_end_time IS NOT NULL
         AND p_start_time >= p_end_time THEN
        RAISE EXCEPTION 'invalid_time_range';
      END IF;

      IF auth.role() IS DISTINCT FROM 'service_role'
         AND session_user NOT IN ('postgres', 'supabase_admin')
         AND NOT marie_wedding.is_admin() THEN
        SELECT p.id
          INTO v_caller
        FROM marie_wedding.profiles p
        WHERE p.user_id = auth.uid()
          AND p.deleted_at IS NULL;

        IF v_caller IS DISTINCT FROM p_provider_profile_id THEN
          RAISE EXCEPTION 'booking_calendar_forbidden'
            USING ERRCODE = '42501';
        END IF;
      END IF;

      RETURN QUERY
      SELECT
        b.id,
        b.contract_id,
        b.start_time,
        b.end_time,
        b.status,
        (b.start_time IS NULL OR b.end_time IS NULL)
      FROM marie_wedding.bookings b
      WHERE b.provider_profile_id = p_provider_profile_id
        AND b.event_date = p_event_date
        AND b.status IN ('scheduled', 'in_progress')
        AND b.deleted_at IS NULL
        AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
        AND (
          p_start_time IS NULL
          OR p_end_time IS NULL
          OR b.start_time IS NULL
          OR b.end_time IS NULL
          OR (p_start_time < b.end_time AND b.start_time < p_end_time)
        );
    END;
    $function$;
  $ddl$;
END
$do$;

DO $do$
BEGIN
  IF to_regprocedure('marie_wedding.get_month_bookings(uuid,date,date)') IS NULL
     OR to_regclass('marie_wedding.bookings') IS NULL
     OR to_regclass('marie_wedding.contracts') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.get_month_bookings(
      p_provider_profile_id uuid,
      p_from date,
      p_to date
    )
    RETURNS TABLE (
      booking_id uuid,
      contract_id uuid,
      contract_title text,
      counterpart_name text,
      event_date date,
      start_time time,
      end_time time,
      venue text,
      status text,
      note text
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_caller uuid;
    BEGIN
      IF p_provider_profile_id IS NULL
         OR p_from IS NULL
         OR p_to IS NULL
         OR p_from > p_to
         OR p_to - p_from > 370 THEN
        RAISE EXCEPTION 'invalid_booking_date_range';
      END IF;

      IF auth.role() IS DISTINCT FROM 'service_role'
         AND session_user NOT IN ('postgres', 'supabase_admin')
         AND NOT marie_wedding.is_admin() THEN
        SELECT p.id
          INTO v_caller
        FROM marie_wedding.profiles p
        WHERE p.user_id = auth.uid()
          AND p.deleted_at IS NULL;

        IF v_caller IS DISTINCT FROM p_provider_profile_id THEN
          RAISE EXCEPTION 'booking_calendar_forbidden'
            USING ERRCODE = '42501';
        END IF;
      END IF;

      RETURN QUERY
      SELECT
        b.id,
        b.contract_id,
        c.title,
        CASE
          WHEN b.provider_profile_id = c.party_a_profile_id THEN c.party_b_org_name
          ELSE c.party_a_org_name
        END,
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
        AND c.deleted_at IS NULL
      ORDER BY b.event_date, b.start_time NULLS FIRST;
    END;
    $function$;
  $ddl$;
END
$do$;

DO $do$
BEGIN
  IF to_regprocedure('marie_wedding.get_day_digest(uuid,date)') IS NULL
     OR to_regclass('marie_wedding.bookings') IS NULL
     OR to_regclass('marie_wedding.contracts') IS NULL
     OR to_regclass('marie_wedding.availability_slots') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.get_day_digest(
      p_provider_profile_id uuid,
      p_date date
    )
    RETURNS TABLE (
      kind text,
      ref_id uuid,
      start_time time,
      end_time time,
      label text,
      status text
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_caller uuid;
    BEGIN
      IF p_provider_profile_id IS NULL OR p_date IS NULL THEN
        RAISE EXCEPTION 'invalid_booking_scope';
      END IF;

      IF auth.role() IS DISTINCT FROM 'service_role'
         AND session_user NOT IN ('postgres', 'supabase_admin')
         AND NOT marie_wedding.is_admin() THEN
        SELECT p.id
          INTO v_caller
        FROM marie_wedding.profiles p
        WHERE p.user_id = auth.uid()
          AND p.deleted_at IS NULL;

        IF v_caller IS DISTINCT FROM p_provider_profile_id THEN
          RAISE EXCEPTION 'booking_calendar_forbidden'
            USING ERRCODE = '42501';
        END IF;
      END IF;

      RETURN QUERY
      SELECT
        'booking'::text,
        b.id,
        b.start_time,
        b.end_time,
        c.title,
        b.status
      FROM marie_wedding.bookings b
      JOIN marie_wedding.contracts c ON c.id = b.contract_id
      WHERE b.provider_profile_id = p_provider_profile_id
        AND b.event_date = p_date
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL

      UNION ALL

      SELECT
        'contract_event'::text,
        c.id,
        NULL::time,
        NULL::time,
        c.title,
        c.status
      FROM marie_wedding.contracts c
      WHERE (
          c.party_a_profile_id = p_provider_profile_id
          OR c.party_b_profile_id = p_provider_profile_id
        )
        AND c.event_date = p_date
        AND c.status IN ('signed', 'in_progress')
        AND c.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM marie_wedding.bookings b2
          WHERE b2.contract_id = c.id
            AND b2.deleted_at IS NULL
        )

      UNION ALL

      SELECT
        'availability'::text,
        s.id,
        NULL::time,
        NULL::time,
        NULL::text,
        s.status
      FROM marie_wedding.availability_slots s
      WHERE s.profile_id = p_provider_profile_id
        AND s.date = p_date

      ORDER BY 4 NULLS LAST, 3 NULLS LAST;
    END;
    $function$;
  $ddl$;
END
$do$;

-- create_booking_safe/update_booking_time previously delegated their conflict
-- query to check_booking_conflict.  That detail function is now owner-only, so
-- keep the transaction RPCs available to either contract party by doing the
-- same conflict check internally.  The advisory lock also closes the original
-- check-then-insert race for one provider/date calendar.
DO $do$
BEGIN
  IF to_regprocedure(
       'marie_wedding.create_booking_safe(uuid,uuid,date,time without time zone,time without time zone,text,text)'
     ) IS NULL
     OR to_regclass('marie_wedding.bookings') IS NULL
     OR to_regclass('marie_wedding.contracts') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.create_booking_safe(
      p_contract_id uuid,
      p_provider_profile_id uuid,
      p_event_date date,
      p_start_time time DEFAULT NULL,
      p_end_time time DEFAULT NULL,
      p_note text DEFAULT NULL,
      p_venue text DEFAULT NULL
    )
    RETURNS marie_wedding.bookings
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_caller uuid;
      v_contract marie_wedding.contracts%ROWTYPE;
      v_booking marie_wedding.bookings%ROWTYPE;
    BEGIN
      SELECT p.id
        INTO v_caller
      FROM marie_wedding.profiles p
      WHERE p.user_id = auth.uid()
        AND p.deleted_at IS NULL;

      IF v_caller IS NULL THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
      END IF;
      IF p_provider_profile_id IS NULL OR p_event_date IS NULL THEN
        RAISE EXCEPTION 'invalid_booking_scope';
      END IF;
      IF p_start_time IS NOT NULL
         AND p_end_time IS NOT NULL
         AND p_start_time >= p_end_time THEN
        RAISE EXCEPTION 'invalid_time_range';
      END IF;

      SELECT *
        INTO v_contract
      FROM marie_wedding.contracts
      WHERE id = p_contract_id
        AND deleted_at IS NULL
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'contract_not_found';
      END IF;
      IF v_caller NOT IN (
        v_contract.party_a_profile_id,
        v_contract.party_b_profile_id
      ) THEN
        RAISE EXCEPTION 'not_party_to_contract' USING ERRCODE = '42501';
      END IF;
      IF v_contract.status NOT IN ('signed', 'in_progress') THEN
        RAISE EXCEPTION 'contract_not_signed';
      END IF;
      IF p_provider_profile_id NOT IN (
        v_contract.party_a_profile_id,
        v_contract.party_b_profile_id
      ) THEN
        RAISE EXCEPTION 'provider_must_be_party';
      END IF;

      PERFORM pg_advisory_xact_lock(
        hashtextextended(
          p_provider_profile_id::text || ':' || p_event_date::text,
          0
        )
      );

      IF EXISTS (
        SELECT 1
        FROM marie_wedding.bookings b
        WHERE b.provider_profile_id = p_provider_profile_id
          AND b.event_date = p_event_date
          AND b.status IN ('scheduled', 'in_progress')
          AND b.deleted_at IS NULL
          AND (
            p_start_time IS NULL
            OR p_end_time IS NULL
            OR b.start_time IS NULL
            OR b.end_time IS NULL
            OR (p_start_time < b.end_time AND b.start_time < p_end_time)
          )
      ) THEN
        RAISE EXCEPTION 'booking_conflict';
      END IF;

      INSERT INTO marie_wedding.bookings (
        contract_id,
        provider_profile_id,
        event_date,
        start_time,
        end_time,
        venue,
        status,
        note
      ) VALUES (
        p_contract_id,
        p_provider_profile_id,
        p_event_date,
        p_start_time,
        p_end_time,
        p_venue,
        'scheduled',
        p_note
      )
      RETURNING * INTO v_booking;

      RETURN v_booking;
    END;
    $function$;
  $ddl$;
END
$do$;

DO $do$
BEGIN
  IF to_regprocedure(
       'marie_wedding.update_booking_time(uuid,date,time without time zone,time without time zone)'
     ) IS NULL
     OR to_regclass('marie_wedding.bookings') IS NULL
     OR to_regclass('marie_wedding.contracts') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.update_booking_time(
      p_booking_id uuid,
      p_event_date date,
      p_start_time time DEFAULT NULL,
      p_end_time time DEFAULT NULL
    )
    RETURNS marie_wedding.bookings
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_caller uuid;
      v_booking marie_wedding.bookings%ROWTYPE;
      v_contract marie_wedding.contracts%ROWTYPE;
    BEGIN
      SELECT p.id
        INTO v_caller
      FROM marie_wedding.profiles p
      WHERE p.user_id = auth.uid()
        AND p.deleted_at IS NULL;

      IF v_caller IS NULL THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
      END IF;
      IF p_event_date IS NULL THEN
        RAISE EXCEPTION 'invalid_booking_scope';
      END IF;
      IF p_start_time IS NOT NULL
         AND p_end_time IS NOT NULL
         AND p_start_time >= p_end_time THEN
        RAISE EXCEPTION 'invalid_time_range';
      END IF;

      SELECT *
        INTO v_booking
      FROM marie_wedding.bookings
      WHERE id = p_booking_id
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'booking_not_found';
      END IF;

      SELECT *
        INTO v_contract
      FROM marie_wedding.contracts
      WHERE id = v_booking.contract_id
        AND deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'contract_not_found';
      END IF;
      IF v_caller <> v_booking.provider_profile_id
         AND v_caller NOT IN (
           v_contract.party_a_profile_id,
           v_contract.party_b_profile_id
         ) THEN
        RAISE EXCEPTION 'not_party_to_booking' USING ERRCODE = '42501';
      END IF;

      PERFORM pg_advisory_xact_lock(
        hashtextextended(
          v_booking.provider_profile_id::text || ':' || p_event_date::text,
          0
        )
      );

      IF EXISTS (
        SELECT 1
        FROM marie_wedding.bookings b
        WHERE b.provider_profile_id = v_booking.provider_profile_id
          AND b.event_date = p_event_date
          AND b.id <> p_booking_id
          AND b.status IN ('scheduled', 'in_progress')
          AND b.deleted_at IS NULL
          AND (
            p_start_time IS NULL
            OR p_end_time IS NULL
            OR b.start_time IS NULL
            OR b.end_time IS NULL
            OR (p_start_time < b.end_time AND b.start_time < p_end_time)
          )
      ) THEN
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
    $function$;
  $ddl$;
END
$do$;

-- Revoke every overload first.  Only the exact guarded legacy signatures are
-- granted back to authenticated; unknown overloads remain server-only.
DO $do$
DECLARE
  v_function record;
  v_signature text;
  v_oid oid;
BEGIN
  FOR v_function IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'marie_wedding'
      AND p.prokind = 'f'
      AND p.proname = ANY (ARRAY[
        'check_booking_conflict',
        'get_month_bookings',
        'get_day_digest'
      ]::text[])
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
  END LOOP;

  FOREACH v_signature IN ARRAY ARRAY[
    'marie_wedding.check_booking_conflict(uuid,date,time without time zone,time without time zone,uuid)',
    'marie_wedding.get_month_bookings(uuid,date,date)',
    'marie_wedding.get_day_digest(uuid,date)'
  ]::text[] LOOP
    v_oid := to_regprocedure(v_signature);
    IF v_oid IS NOT NULL THEN
      SELECT
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid) AS identity_args
        INTO v_function
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.oid = v_oid;

      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
        v_function.nspname,
        v_function.proname,
        v_function.identity_args
      );
    END IF;
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 8. Settlements: trusted creation, bounded fee, and contract-party payee.
-- ---------------------------------------------------------------------------

DO $do$
DECLARE
  v_has_invalid_rate boolean;
BEGIN
  IF to_regclass('marie_wedding.settlements') IS NULL
     OR to_regclass('marie_wedding.contracts') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'marie_wedding.settlements'::regclass
      AND c.conname = 'settlements_platform_fee_rate_range'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE marie_wedding.settlements
      ADD CONSTRAINT settlements_platform_fee_rate_range
      CHECK (platform_fee_rate >= 0 AND platform_fee_rate <= 1) NOT VALID
    $ddl$;
  END IF;

  EXECUTE $sql$
    SELECT EXISTS (
      SELECT 1
      FROM marie_wedding.settlements
      WHERE platform_fee_rate IS NULL
         OR platform_fee_rate < 0
         OR platform_fee_rate > 1
    )
  $sql$ INTO v_has_invalid_rate;

  IF NOT v_has_invalid_rate THEN
    EXECUTE $ddl$
      ALTER TABLE marie_wedding.settlements
      VALIDATE CONSTRAINT settlements_platform_fee_rate_range
    $ddl$;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.enforce_settlement_contract_payee()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_party_a uuid;
      v_party_b uuid;
    BEGIN
      IF NEW.platform_fee_rate IS NULL
         OR NEW.platform_fee_rate < 0
         OR NEW.platform_fee_rate > 1 THEN
        RAISE EXCEPTION 'invalid_platform_fee_rate'
          USING ERRCODE = '23514';
      END IF;

      SELECT c.party_a_profile_id, c.party_b_profile_id
        INTO v_party_a, v_party_b
      FROM marie_wedding.contracts c
      WHERE c.id = NEW.contract_id
        AND c.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'contract_not_found'
          USING ERRCODE = '23503';
      END IF;

      IF NEW.payee_profile_id IS DISTINCT FROM v_party_a
         AND NEW.payee_profile_id IS DISTINCT FROM v_party_b THEN
        RAISE EXCEPTION 'settlement_payee_must_be_contract_party'
          USING ERRCODE = '23514';
      END IF;

      RETURN NEW;
    END;
    $function$;
  $ddl$;

  EXECUTE 'DROP TRIGGER IF EXISTS enforce_settlement_contract_payee ON marie_wedding.settlements';
  EXECUTE $ddl$
    CREATE TRIGGER enforce_settlement_contract_payee
      BEFORE INSERT OR UPDATE OF contract_id, payee_profile_id, platform_fee_rate
      ON marie_wedding.settlements
      FOR EACH ROW
      EXECUTE FUNCTION marie_wedding.enforce_settlement_contract_payee()
  $ddl$;

  EXECUTE 'REVOKE ALL ON FUNCTION marie_wedding.enforce_settlement_contract_payee() FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION marie_wedding.enforce_settlement_contract_payee() TO service_role';
END
$do$;

DO $do$
BEGIN
  IF to_regprocedure(
       'marie_wedding.create_settlement_from_contract(uuid,text,numeric)'
     ) IS NULL
     OR to_regclass('marie_wedding.settlements') IS NULL
     OR to_regclass('marie_wedding.contracts') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION marie_wedding.create_settlement_from_contract(
      p_contract_id uuid,
      p_payee_side text DEFAULT 'party_b',
      p_fee_rate_override numeric DEFAULT NULL
    )
    RETURNS marie_wedding.settlements
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'marie_wedding', 'public'
    AS $function$
    DECLARE
      v_contract marie_wedding.contracts%ROWTYPE;
      v_payee uuid;
      v_fee_rate numeric;
      v_gross numeric;
      v_fee_amount numeric;
      v_net numeric;
      v_settlement marie_wedding.settlements%ROWTYPE;
    BEGIN
      IF auth.role() IS DISTINCT FROM 'service_role'
         AND session_user NOT IN ('postgres', 'supabase_admin')
         AND NOT marie_wedding.is_admin() THEN
        RAISE EXCEPTION 'admin_or_service_role_only'
          USING ERRCODE = '42501';
      END IF;

      IF p_payee_side NOT IN ('party_a', 'party_b') THEN
        RAISE EXCEPTION 'invalid_payee_side';
      END IF;

      SELECT *
        INTO v_contract
      FROM marie_wedding.contracts
      WHERE id = p_contract_id
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'contract_not_found';
      END IF;
      IF v_contract.status <> 'completed' THEN
        RAISE EXCEPTION 'contract_not_completed';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM marie_wedding.settlements
        WHERE contract_id = p_contract_id
          AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'settlement_already_exists';
      END IF;

      v_payee := CASE p_payee_side
        WHEN 'party_a' THEN v_contract.party_a_profile_id
        WHEN 'party_b' THEN v_contract.party_b_profile_id
      END;
      IF v_payee IS NULL THEN
        RAISE EXCEPTION 'contract_payee_missing';
      END IF;

      v_fee_rate := COALESCE(
        p_fee_rate_override,
        marie_wedding.platform_fee_rate()
      );
      IF v_fee_rate IS NULL OR v_fee_rate < 0 OR v_fee_rate > 1 THEN
        RAISE EXCEPTION 'invalid_platform_fee_rate';
      END IF;

      v_gross := v_contract.total_amount;
      IF v_gross IS NULL OR v_gross < 0 THEN
        RAISE EXCEPTION 'invalid_contract_amount';
      END IF;

      v_fee_amount := round(v_gross * v_fee_rate);
      v_net := v_gross - v_fee_amount;

      INSERT INTO marie_wedding.settlements (
        contract_id,
        payee_profile_id,
        gross_amount,
        platform_fee_rate,
        platform_fee_amount,
        tax_withheld,
        net_amount,
        status
      ) VALUES (
        p_contract_id,
        v_payee,
        v_gross,
        v_fee_rate,
        v_fee_amount,
        0,
        v_net,
        'pending'
      )
      RETURNING * INTO v_settlement;

      RETURN v_settlement;
    END;
    $function$;
  $ddl$;
END
$do$;

-- Unknown create_settlement overloads remain service-only.  The exact guarded
-- legacy signature is granted to authenticated so a database admin profile can
-- still use the RPC; the function itself rejects every non-admin caller.
DO $do$
DECLARE
  v_function record;
  v_oid oid;
BEGIN
  FOR v_function IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'marie_wedding'
      AND p.prokind = 'f'
      AND p.proname = 'create_settlement_from_contract'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
  END LOOP;

  v_oid := to_regprocedure(
    'marie_wedding.create_settlement_from_contract(uuid,text,numeric)'
  );
  IF v_oid IS NOT NULL THEN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
      INTO v_function
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.oid = v_oid;

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 9. Maintenance SECURITY DEFINER functions are scheduler/server-only.
-- ---------------------------------------------------------------------------

DO $do$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'marie_wedding'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND (
        p.proname ~ '^(cleanup_|expire_|refresh_all_)'
        OR p.proname IN (
          'process_review_reminders',
          'process_saved_search_notifications'
        )
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
  END LOOP;
END
$do$;

NOTIFY pgrst, 'reload schema';

COMMIT;
