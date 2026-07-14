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
