-- ===================================================================
-- fix(32): Storage 버킷 파일 크기 제한 상향 (이미지 업로드 413 실패 해결)
-- ===================================================================
-- 문제: 클라이언트 크기 제한은 제거했지만, Supabase 버킷 자체에 file_size_limit 이
--       걸려 있어 큰 이미지(압축 실패로 원본이 올라가는 경우)가 413 으로 거부됨.
--   - avatars    : 2MB (프로필·디렉토리 이미지)  ← 가장 자주 걸림
--   - job-images : 5MB (공고)
--   - portfolios : 5MB
--   - event-images: 10MB
-- 해결: 넉넉히 50MB 로 상향. 실제 업로드는 클라이언트 워커 압축(목표 ~1MB)으로 작게
--       유지되고, 압축 실패 시에도 원본이 거부되지 않도록 하는 안전망.
-- 적용: pg-meta 로 실행 완료 (2026-07-13). storage.buckets 는 direct DELETE 는 막혀있지만
--       UPDATE 는 허용됨.

UPDATE storage.buckets
   SET file_size_limit = 52428800  -- 50MB
 WHERE id IN ('avatars', 'job-images', 'portfolios', 'event-images');

-- 참고: portfolios 는 allowed_mime_types 로 jpeg/png/webp/gif 만 허용 중.
-- 압축 산출물은 image/jpeg 라 정상 통과하나, HEIC 원본이 압축 폴백으로 그대로 오면
-- mime 거부될 수 있음(엣지). 필요 시 별도 승인 후 allowed_mime_types 조정.
