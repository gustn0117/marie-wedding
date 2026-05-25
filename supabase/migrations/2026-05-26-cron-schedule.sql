-- pg_cron 자동 스케줄 등록
-- 작성일: 2026-05-26
-- 운영 DB에 이미 등록되어 있음 (idempotent하지 않으므로 재실행 전 cron.job 확인 필요)

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 등록된 cron (참고용 SQL, 중복 등록 방지 위해 운영에선 cron.job 조회 후 결정):
--
-- SELECT cron.schedule('marie-review-reminders', '0 9 * * *',
--   $$ SELECT marie_wedding.process_review_reminders(); $$);
-- SELECT cron.schedule('marie-cleanup-view-dedup', '0 4 * * *',
--   $$ SELECT marie_wedding.cleanup_job_view_dedup(); $$);
-- SELECT cron.schedule('marie-cleanup-otps', '0 */6 * * *',
--   $$ SELECT marie_wedding.cleanup_expired_otps(); $$);
-- SELECT cron.schedule('marie-job-status-refresh', '*/30 * * * *',
--   $$ SELECT marie_wedding.refresh_all_job_statuses(); $$);
-- SELECT cron.schedule('marie-saved-search-match', '0 9 * * *',
--   $$ SELECT marie_wedding.process_saved_search_notifications(); $$);
-- SELECT cron.schedule('marie-expire-promotions', '0 * * * *',
--   $$ SELECT marie_wedding.expire_promotions(); $$);
--
-- 등록 상태 확인: SELECT jobname, schedule, active FROM cron.job ORDER BY jobid;
-- 해제: SELECT cron.unschedule('marie-...');
