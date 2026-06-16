-- Refocus Marié on wedding-industry recruiting, profiles, community, and ads.
-- Historical 2026-06-08 B2B deal migrations are left in history, then retired here.

BEGIN;

-- Existing matching posts are retained as hiring posts so public job surfaces stay readable.
UPDATE marie_wedding.jobs
SET posting_type = 'hiring'
WHERE posting_type::text = 'matching';

-- Make posting_type hiring-only for future writes.
DO $$
BEGIN
  IF to_regclass('marie_wedding.jobs') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'marie_wedding'
         AND t.typname = 'posting_type'
         AND e.enumlabel = 'matching'
     ) THEN
    ALTER TABLE marie_wedding.jobs ALTER COLUMN posting_type DROP DEFAULT;
    DROP TYPE IF EXISTS marie_wedding.posting_type_hiring_only;
    CREATE TYPE marie_wedding.posting_type_hiring_only AS ENUM ('hiring');
    ALTER TABLE marie_wedding.jobs
      ALTER COLUMN posting_type TYPE marie_wedding.posting_type_hiring_only
      USING 'hiring'::marie_wedding.posting_type_hiring_only;
    DROP TYPE marie_wedding.posting_type;
    ALTER TYPE marie_wedding.posting_type_hiring_only RENAME TO posting_type;
    ALTER TABLE marie_wedding.jobs
      ALTER COLUMN posting_type SET DEFAULT 'hiring'::marie_wedding.posting_type;
  END IF;
END $$;

-- Retire quotation/contract/booking/settlement/organization surfaces.
DROP TABLE IF EXISTS marie_wedding.settlements CASCADE;
DROP TABLE IF EXISTS marie_wedding.bookings CASCADE;
DROP TABLE IF EXISTS marie_wedding.contract_signatures CASCADE;
DROP TABLE IF EXISTS marie_wedding.contracts CASCADE;
DROP TABLE IF EXISTS marie_wedding.quotation_items CASCADE;
DROP TABLE IF EXISTS marie_wedding.quotations CASCADE;
DROP TABLE IF EXISTS marie_wedding.organization_members CASCADE;
DROP TABLE IF EXISTS marie_wedding.organizations CASCADE;

DROP FUNCTION IF EXISTS marie_wedding.transition_quotation_status(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.expire_quotations();
DROP FUNCTION IF EXISTS marie_wedding.create_contract_from_quotation(UUID, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.recalc_quotation_total();
DROP FUNCTION IF EXISTS marie_wedding.check_contract_full_signed();
DROP FUNCTION IF EXISTS marie_wedding.sign_contract(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.cancel_contract(UUID, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.mark_contract_in_progress(UUID);
DROP FUNCTION IF EXISTS marie_wedding.complete_contract(UUID);
DROP FUNCTION IF EXISTS marie_wedding.create_booking_from_contract(UUID, TEXT, TIME, TIME, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.check_booking_conflict(UUID, DATE, TIME, TIME, UUID);
DROP FUNCTION IF EXISTS marie_wedding.create_booking_safe(UUID, UUID, DATE, TIME, TIME, TEXT, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.update_booking_status(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.update_booking_time(UUID, DATE, TIME, TIME);
DROP FUNCTION IF EXISTS marie_wedding.get_month_bookings(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS marie_wedding.get_day_digest(UUID, DATE);
DROP FUNCTION IF EXISTS marie_wedding.org_role_of(UUID, UUID);
DROP FUNCTION IF EXISTS marie_wedding.is_org_member(UUID, UUID);
DROP FUNCTION IF EXISTS marie_wedding.create_organization(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.invite_organization_member(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.accept_organization_invite(UUID);
DROP FUNCTION IF EXISTS marie_wedding.update_member_role(UUID, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.remove_organization_member(UUID);
DROP FUNCTION IF EXISTS marie_wedding.platform_fee_rate();
DROP FUNCTION IF EXISTS marie_wedding.create_settlement_from_contract(UUID, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS marie_wedding.approve_settlement(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS marie_wedding.process_settlement(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.mark_settlement_paid(UUID, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.fail_settlement(UUID, TEXT);
DROP FUNCTION IF EXISTS marie_wedding.cancel_settlement(UUID);
DROP FUNCTION IF EXISTS marie_wedding.auto_create_settlement_on_complete();

-- Keep audit_log as an operator-facing product audit trail.
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

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON marie_wedding.audit_log(table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
  ON marie_wedding.audit_log(changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
  ON marie_wedding.audit_log(changed_at DESC);

CREATE OR REPLACE FUNCTION marie_wedding.log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_changed_by UUID;
  v_old JSONB;
  v_new JSONB;
  v_changed_cols TEXT[];
BEGIN
  SELECT id INTO v_changed_by
  FROM marie_wedding.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO marie_wedding.audit_log (table_name, record_id, action, changed_by, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'insert', v_changed_by, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    SELECT ARRAY_AGG(key ORDER BY key)
    INTO v_changed_cols
    FROM jsonb_each(v_new)
    WHERE v_old -> key IS DISTINCT FROM value;

    IF v_changed_cols IS NOT NULL AND array_length(v_changed_cols, 1) > 0 THEN
      INSERT INTO marie_wedding.audit_log (table_name, record_id, action, changed_by, old_data, new_data, changed_columns)
      VALUES (TG_TABLE_NAME, NEW.id, 'update', v_changed_by, v_old, v_new, v_changed_cols);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO marie_wedding.audit_log (table_name, record_id, action, changed_by, old_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', v_changed_by, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'jobs',
    'applications',
    'posts',
    'comments',
    'reviews',
    'reports',
    'payments',
    'banners'
  ] LOOP
    IF to_regclass('marie_wedding.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON marie_wedding.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON marie_wedding.%I FOR EACH ROW EXECUTE FUNCTION marie_wedding.log_changes()',
        t,
        t
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE marie_wedding.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_admin_select ON marie_wedding.audit_log;
CREATE POLICY audit_log_admin_select ON marie_wedding.audit_log
  FOR SELECT USING (marie_wedding.is_admin());

NOTIFY pgrst, 'reload schema';

COMMIT;
