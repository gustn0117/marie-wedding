#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-}"
DATABASE_CONNECTION="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="${ROOT_DIR}/supabase/migrations"

if [[ -z "${DATABASE_CONNECTION}" ]]; then
  echo "SUPABASE_DB_URL 또는 DATABASE_URL을 설정해야 합니다." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql 명령을 찾을 수 없습니다." >&2
  exit 1
fi

apply_file() {
  local filename="$1"
  echo "Applying ${filename}"
  psql "${DATABASE_CONNECTION}" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --file="${MIGRATION_DIR}/${filename}"
}

apply_pre_app() {
  apply_file "20260714000100_admin_broadcast_outbox.sql"
  apply_file "20260714000200_otp_atomic_verification.sql"
  apply_file "20260714000300_password_admin_service_operations.sql"
  apply_file "20260714000400_payment_catalog_hardening.sql"
  # Additive resume tables/RPC must exist before the application build that
  # starts using them.  It is independent of the final direct-write revokes.
  apply_file "20260715000100_resume_system.sql"
  # 7/18 hardening — MUST run after the 07-14 files, which re-CREATE the OLD
  # reactivate/purge/is_admin. Omitting these here means a release run reverts the
  # withdrawal PII scrub, storage lockdown, and admin-role guards on the LIVE DB.
  apply_file "20260718000100_withdraw_purge_resumes_and_name_reset.sql"
  apply_file "20260718000200_withdraw_purge_storage_and_inquiries.sql"
  apply_file "20260718000300_scale_indexes.sql"
  apply_file "20260718000400_security_storage_and_admin_role.sql"
  apply_file "20260718000500_profiles_featured_columns.sql"
  # refresh_job_status: 미래 마감일로 수정 시 closed/urgent → open 재오픈 (sweep v3 #5).
  # 빠지면 릴리스 run 이 재오픈 버그가 있는 옛 트리거로 되돌린다.
  apply_file "20260719000100_job_reopen_on_future_deadline.sql"
  # 스토리지 보안(sweep v4 #1/#3): 반드시 20260718000400 '뒤'에 와야 한다 — 그 파일이
  # job_images_update/delete 를 재생성하므로, 이 파일이 다시 DROP 해 교차테넌트 훼손 구멍을 막는다.
  apply_file "20260719000200_storage_security_hardening.sql"
  # purge like_count 재동기화(sweep v4 #9): 20260718000100 원본 purge 를 덮어써야 하므로 뒤에 온다.
  apply_file "20260719000300_purge_resync_like_count.sql"
}

apply_security_boundary() {
  apply_file "20260714000500_security_boundaries.sql"
}

case "${MODE}" in
  pre-app)
    apply_pre_app
    ;;
  security)
    apply_security_boundary
    ;;
  all)
    if [[ "${MARIE_APP_DRAINED:-}" != "1" ]]; then
      echo "all 모드는 기존 앱 프로세스를 모두 내린 뒤 MARIE_APP_DRAINED=1로 실행하세요." >&2
      exit 1
    fi
    apply_pre_app
    apply_security_boundary
    ;;
  *)
    echo "사용법: $0 {pre-app|security|all}" >&2
    exit 1
    ;;
esac
