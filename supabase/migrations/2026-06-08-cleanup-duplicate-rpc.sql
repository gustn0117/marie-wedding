-- 중복 RPC 정리.
-- increment_job_view_count가 (p_job_id uuid)와 (p_job_id uuid, p_viewer_key text) 두 시그니처로 등록.
-- 실제 호출처(src/features/jobs/components/JobViewTracker.tsx:46)는 2-arg 시그니처 사용.
-- 1-arg 옛 버전 삭제.

DROP FUNCTION IF EXISTS marie_wedding.increment_job_view_count(p_job_id UUID);

NOTIFY pgrst, 'reload schema';
