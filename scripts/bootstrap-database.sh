#!/usr/bin/env bash

# Rebuild the current Marié application schema on a fresh Supabase database.
#
# This repository predates timestamp-only Supabase migration names.  Several
# same-day files have real dependencies that filename sorting cannot express
# (for example trust-layer.sql must precede its phase files, and social-login
# must precede drop-apple-provider).  Keep this list as the canonical bootstrap
# order; production upgrades continue to use their existing migration history.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="${ROOT_DIR}/supabase/schema.sql"
MIGRATION_DIR="${ROOT_DIR}/supabase/migrations"
DATABASE_CONNECTION="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
PSQL_BIN="${PSQL_BIN:-psql}"

export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

if [[ -z "${DATABASE_CONNECTION}" ]]; then
  echo "SUPABASE_DB_URL 또는 DATABASE_URL을 설정해야 합니다." >&2
  exit 1
fi

if ! command -v "${PSQL_BIN}" >/dev/null 2>&1; then
  echo "psql 명령을 찾을 수 없습니다 (PSQL_BIN=${PSQL_BIN})." >&2
  exit 1
fi

if [[ ! -r "${SCHEMA_FILE}" ]]; then
  echo "기준 스키마를 읽을 수 없습니다: ${SCHEMA_FILE}" >&2
  exit 1
fi

# Canonical order for a new database.  Do not replace this with a glob/sort.
MIGRATIONS=(
  "20260524_platform_systems.sql"

  "2026-05-25-trust-layer.sql"
  "2026-05-25-trust-layer-seed.sql"
  "2026-05-25-trust-layer-phase2.sql"
  "2026-05-25-trust-layer-phase3.sql"
  "2026-05-25-trust-layer-phase4.sql"
  "2026-05-25-trust-layer-phase5.sql"
  "2026-05-25-community-categories.sql"
  "2026-05-25-job-status.sql"
  "2026-05-25-platform-boost-1.sql"
  "2026-05-25-platform-boost-2.sql"
  "2026-05-25-platform-boost-3.sql"
  "2026-05-25-monetization-prep.sql"
  "2026-05-25-stabilize-1.sql"
  "2026-05-25-cron-jobs.sql"

  "2026-05-26-moderation.sql"
  "2026-05-26-salary-payments.sql"
  "2026-05-26-saved-search-cron.sql"
  "2026-05-26-purge-cascade.sql"
  "2026-05-26-cron-schedule.sql"

  "2026-06-08-application-status-hardening.sql"
  "2026-06-08-security-hardening-batch.sql"
  "2026-06-08-b2b-deal-model.sql"
  "2026-06-08-organization-rpcs.sql"
  "2026-06-08-quotation-rpcs.sql"
  "2026-06-08-contract-rpcs.sql"
  "2026-06-08-booking-rpcs.sql"
  "2026-06-08-settlement-rpcs.sql"
  "2026-06-08-payment-rpcs.sql"
  "2026-06-08-cleanup-duplicate-rpc.sql"

  "2026-06-09-hero-banners.sql"
  "2026-06-16-refocus-jobs-platform.sql"
  "2026-06-19-social-login.sql"
  "2026-06-19-drop-apple-provider.sql"
  "2026-06-21-featured-jobs.sql"
  "2026-06-22-cancel-my-account.sql"
  "2026-06-23-applicant-account-type-guard.sql"
  "2026-06-23-default-listed-true.sql"
  "2026-06-23-profile-soft-delete-unlist.sql"
  "2026-06-29-trigger-hardening.sql"
  "2026-06-29-purge-profile-cascade.sql"
  "2026-07-08-purge-cascade-extended.sql"
  "2026-07-12-audit-db-hardening.sql"
  "2026-07-12-cover-image.sql"
  "2026-07-13-bucket-size-limits.sql"
  "2026-07-13-scale-composite-indexes.sql"

  "20260714000100_admin_broadcast_outbox.sql"
  "20260714000200_otp_atomic_verification.sql"
  "20260714000300_password_admin_service_operations.sql"
  "20260714000400_payment_catalog_hardening.sql"
  "20260714000500_security_boundaries.sql"
  "20260715000100_resume_system.sql"
  "20260718000100_withdraw_purge_resumes_and_name_reset.sql"
  "20260718000200_withdraw_purge_storage_and_inquiries.sql"
  "20260718000300_scale_indexes.sql"
  "20260718000400_security_storage_and_admin_role.sql"
  "20260718000500_profiles_featured_columns.sql"
  "20260719000100_job_reopen_on_future_deadline.sql"
  "20260719000200_storage_security_hardening.sql"
  "20260719000300_purge_resync_like_count.sql"
  "20260719000400_admin_mail.sql"
)

psql_value() {
  "${PSQL_BIN}" "${DATABASE_CONNECTION}" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --tuples-only \
    --no-align \
    --command="$1"
}

apply_file() {
  local path="$1"
  echo "Applying ${path#"${ROOT_DIR}/"}"
  "${PSQL_BIN}" "${DATABASE_CONNECTION}" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --file="${path}"
}

apply_fresh_runtime_baseline() {
  echo "Applying fresh-only runtime tables and Storage baseline"
  "${PSQL_BIN}" "${DATABASE_CONNECTION}" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- This table existed in the running service before the checked-in migration
-- history was assembled.  It contains contact PII and is reachable only from
-- service-role API/admin routes.
CREATE TABLE IF NOT EXISTS marie_wedding.support_inquiries (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL,
  name TEXT CHECK (name IS NULL OR char_length(name) <= 100),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 40),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 200),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_inquiries_status_created
  ON marie_wedding.support_inquiries(status, created_at DESC);

DROP TRIGGER IF EXISTS support_inquiries_updated_at
  ON marie_wedding.support_inquiries;
CREATE TRIGGER support_inquiries_updated_at
  BEFORE UPDATE ON marie_wedding.support_inquiries
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

ALTER TABLE marie_wedding.support_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marie_wedding.support_inquiries
  FROM PUBLIC, authenticator, anon, authenticated;
GRANT ALL ON TABLE marie_wedding.support_inquiries TO service_role;

-- Public product images are written directly by authenticated browser
-- sessions.  Verification documents are private and written/read only by the
-- service-role routes.  File limits mirror the application validators.
INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
VALUES
  ('avatars', 'avatars', TRUE, 2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
  ('job-images', 'job-images', TRUE, 2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
  ('event-images', 'event-images', TRUE, 2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
  ('portfolios', 'portfolios', TRUE, 2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
  ('banners', 'banners', TRUE, 2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
  ('verifications', 'verifications', FALSE, 8388608,
    ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'image/heic', 'image/avif'
    ]::TEXT[]),
  ('resume-files', 'resume-files', FALSE, 10485760,
    ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
    ]::TEXT[])
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS marie_public_image_read ON storage.objects;
CREATE POLICY marie_public_image_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN (
    'avatars', 'job-images', 'event-images', 'portfolios', 'banners'
  ));

DROP POLICY IF EXISTS marie_avatar_insert_own ON storage.objects;
CREATE POLICY marie_avatar_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND (SELECT marie_wedding.current_profile_id()) IS NOT NULL
  );

DROP POLICY IF EXISTS marie_content_image_insert ON storage.objects;
CREATE POLICY marie_content_image_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('job-images', 'event-images')
    AND (SELECT marie_wedding.current_profile_id()) IS NOT NULL
    AND (SELECT marie_wedding.is_onboarded())
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
SQL
}

apply_cron_baseline() {
  echo "Registering pg_cron schedules"
  "${PSQL_BIN}" "${DATABASE_CONNECTION}" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 <<'SQL'
SELECT cron.schedule(
  'marie-review-reminders', '0 9 * * *',
  'SELECT marie_wedding.process_review_reminders();'
);
SELECT cron.schedule(
  'marie-cleanup-view-dedup', '0 4 * * *',
  'SELECT marie_wedding.cleanup_job_view_dedup();'
);
SELECT cron.schedule(
  'marie-cleanup-otps', '0 */6 * * *',
  'SELECT marie_wedding.cleanup_expired_otps();'
);
SELECT cron.schedule(
  'marie-job-status-refresh', '*/30 * * * *',
  'SELECT marie_wedding.refresh_all_job_statuses();'
);
SELECT cron.schedule(
  'marie-saved-search-match', '0 9 * * *',
  'SELECT marie_wedding.process_saved_search_notifications();'
);
SELECT cron.schedule(
  'marie-expire-promotions', '0 * * * *',
  'SELECT marie_wedding.expire_promotions();'
);
SQL
}

# Fail before the first write when the URL is not a Supabase database.  The
# app schema references Auth and adds policies to Storage, so plain PostgreSQL
# is deliberately not treated as a production-compatible target.
supabase_primitives="$(psql_value "
  SELECT concat_ws(',',
    CASE WHEN to_regclass('auth.users') IS NULL THEN 'auth.users' END,
    CASE WHEN to_regprocedure('auth.uid()') IS NULL THEN 'auth.uid()' END,
    CASE WHEN to_regprocedure('auth.role()') IS NULL THEN 'auth.role()' END,
    CASE WHEN to_regclass('storage.buckets') IS NULL THEN 'storage.buckets' END,
    CASE WHEN to_regclass('storage.objects') IS NULL THEN 'storage.objects' END,
    CASE WHEN to_regprocedure('storage.foldername(text)') IS NULL THEN 'storage.foldername(text)' END,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass('storage.buckets')
        AND attname = 'file_size_limit' AND NOT attisdropped
    ) THEN 'storage.buckets.file_size_limit' END,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass('storage.buckets')
        AND attname = 'allowed_mime_types' AND atttypid = 'text[]'::regtype
        AND NOT attisdropped
    ) THEN 'storage.buckets.allowed_mime_types:text[]' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN 'role:authenticator' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'role:anon' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'role:authenticated' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'role:service_role' END
  );
")"

if [[ -n "${supabase_primitives}" ]]; then
  echo "Supabase Auth/Storage 기본 객체가 없습니다: ${supabase_primitives}" >&2
  echo "Supabase 프로젝트를 먼저 생성한 뒤 이 스크립트를 실행하세요." >&2
  exit 1
fi

existing_objects="$(psql_value "
  SELECT count(*)
  FROM (
    SELECT c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'marie_wedding'
    UNION ALL
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'marie_wedding'
    UNION ALL
    SELECT t.oid
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'marie_wedding'
      AND t.typtype IN ('d', 'e', 'r')
  ) AS app_objects;
")"

if [[ "${existing_objects}" != "0" ]]; then
  echo "marie_wedding 스키마에 이미 ${existing_objects}개 객체가 있습니다." >&2
  echo "이 스크립트는 새 DB 전용입니다. 기존 DB는 scripts/apply-release-migrations.sh를 사용하세요." >&2
  exit 1
fi

if [[ "${MARIE_SKIP_PG_CRON:-0}" != "1" ]]; then
  pg_cron_available="$(psql_value "
    SELECT EXISTS (
      SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
    );
  ")"
  if [[ "${pg_cron_available}" != "t" ]]; then
    echo "pg_cron extension을 사용할 수 없습니다." >&2
    echo "Supabase DB에서 실행하거나, 스키마 픽스처에서만 MARIE_SKIP_PG_CRON=1을 사용하세요." >&2
    exit 1
  fi
fi

# Refuse to silently omit newly added migrations.  The maintainer adding one
# must place it at its dependency-correct position above.
for candidate_path in "${MIGRATION_DIR}"/*.sql; do
  candidate="$(basename "${candidate_path}")"
  listed=0
  for migration in "${MIGRATIONS[@]}"; do
    if [[ "${candidate}" == "${migration}" ]]; then
      listed=1
      break
    fi
  done
  if [[ "${listed}" != "1" ]]; then
    echo "부트스트랩 순서에 없는 migration입니다: ${candidate}" >&2
    exit 1
  fi
done

for migration in "${MIGRATIONS[@]}"; do
  migration_path="${MIGRATION_DIR}/${migration}"
  if [[ ! -r "${migration_path}" ]]; then
    echo "migration을 읽을 수 없습니다: ${migration_path}" >&2
    exit 1
  fi
done

apply_file "${SCHEMA_FILE}"

for migration in "${MIGRATIONS[@]}"; do
  if [[ "${migration}" == "2026-05-26-cron-schedule.sql" \
        && "${MARIE_SKIP_PG_CRON:-0}" == "1" ]]; then
    echo "Skipping supabase/migrations/${migration} (fixture mode)"
    continue
  fi
  apply_file "${MIGRATION_DIR}/${migration}"
done

apply_fresh_runtime_baseline

if [[ "${MARIE_SKIP_PG_CRON:-0}" != "1" ]]; then
  apply_cron_baseline
fi

missing_final_objects="$(psql_value "
  WITH required(kind, object_name, present) AS (
    VALUES
      ('table', 'profiles', to_regclass('marie_wedding.profiles') IS NOT NULL),
      ('table', 'payments', to_regclass('marie_wedding.payments') IS NOT NULL),
      ('table', 'banners', to_regclass('marie_wedding.banners') IS NOT NULL),
      ('table', 'audit_log', to_regclass('marie_wedding.audit_log') IS NOT NULL),
      ('table', 'email_otps', to_regclass('marie_wedding.email_otps') IS NOT NULL),
      ('table', 'admin_broadcast_campaigns', to_regclass('marie_wedding.admin_broadcast_campaigns') IS NOT NULL),
      ('table', 'support_inquiries', to_regclass('marie_wedding.support_inquiries') IS NOT NULL),
      ('table', 'resumes', to_regclass('marie_wedding.resumes') IS NOT NULL),
      ('table', 'application_resume_snapshots', to_regclass('marie_wedding.application_resume_snapshots') IS NOT NULL),
      ('function', 'current_profile_id()', to_regprocedure('marie_wedding.current_profile_id()') IS NOT NULL),
      ('function', 'mark_payment_completed(uuid,text,jsonb)', to_regprocedure('marie_wedding.mark_payment_completed(uuid,text,jsonb)') IS NOT NULL),
      ('function', 'submit_application_with_resume(uuid,uuid,uuid,text,text)', to_regprocedure('marie_wedding.submit_application_with_resume(uuid,uuid,uuid,text,text)') IS NOT NULL)
  )
  SELECT coalesce(string_agg(kind || ':' || object_name, ',' ORDER BY kind, object_name), '')
  FROM required
  WHERE NOT present;
")"

if [[ -n "${missing_final_objects}" ]]; then
  echo "부트스트랩 검증 실패. 누락 객체: ${missing_final_objects}" >&2
  exit 1
fi

invalid_storage_buckets="$(psql_value "
  WITH expected(id, is_public, byte_limit, mime_types) AS (
    VALUES
      ('avatars', TRUE, 2097152::BIGINT,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
      ('job-images', TRUE, 2097152::BIGINT,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
      ('event-images', TRUE, 2097152::BIGINT,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
      ('portfolios', TRUE, 2097152::BIGINT,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
      ('banners', TRUE, 2097152::BIGINT,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]),
      ('verifications', FALSE, 8388608::BIGINT,
        ARRAY[
          'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
          'image/heic', 'image/avif'
        ]::TEXT[]),
      ('resume-files', FALSE, 10485760::BIGINT,
        ARRAY[
          'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
        ]::TEXT[])
  )
  SELECT coalesce(string_agg(e.id, ',' ORDER BY e.id), '')
  FROM expected e
  LEFT JOIN storage.buckets b ON b.id = e.id
  WHERE b.id IS NULL
     OR b.public IS DISTINCT FROM e.is_public
     OR b.file_size_limit IS DISTINCT FROM e.byte_limit
     OR b.allowed_mime_types IS DISTINCT FROM e.mime_types;
")"

if [[ -n "${invalid_storage_buckets}" ]]; then
  echo "부트스트랩 검증 실패. Storage bucket 설정 불일치: ${invalid_storage_buckets}" >&2
  exit 1
fi

if [[ "${MARIE_SKIP_PG_CRON:-0}" != "1" ]]; then
  cron_schedule_count="$(psql_value "
    SELECT count(*)
    FROM cron.job
    WHERE jobname IN (
      'marie-review-reminders', 'marie-cleanup-view-dedup',
      'marie-cleanup-otps', 'marie-job-status-refresh',
      'marie-saved-search-match', 'marie-expire-promotions'
    );
  ")"
  if [[ "${cron_schedule_count}" != "6" ]]; then
    echo "부트스트랩 검증 실패. pg_cron schedule이 ${cron_schedule_count}/6개입니다." >&2
    exit 1
  fi
fi

retired_b2b_tables="$(psql_value "
  SELECT coalesce(string_agg(name, ',' ORDER BY name), '')
  FROM unnest(ARRAY[
    'organizations', 'organization_members', 'quotations', 'quotation_items',
    'contracts', 'contract_signatures', 'bookings', 'settlements'
  ]) AS names(name)
  WHERE to_regclass('marie_wedding.' || name) IS NOT NULL;
")"

if [[ -n "${retired_b2b_tables}" ]]; then
  echo "부트스트랩 검증 실패. 폐기되어야 할 B2B 테이블: ${retired_b2b_tables}" >&2
  exit 1
fi

echo "Marié 새 Supabase DB 부트스트랩과 최종 스키마 검증을 완료했습니다."
