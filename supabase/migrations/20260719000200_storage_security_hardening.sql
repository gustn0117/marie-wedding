-- 스토리지 보안 강화 (sweep v4 #1, #3)
-- 작성일: 2026-07-19

-- #1: job-images 의 UPDATE/DELETE 가 authenticated 전체에 열려 있어(소유자 스코프 없음)
--     아무 로그인 사용자나 타 업체 공고 커버/본문 이미지를 덮어쓰거나 삭제할 수 있었다(교차 테넌트 훼손).
--     업로드는 INSERT 만 필요하고(유니크 경로·upsert 미사용), 클라 UPDATE/DELETE 경로는 없으므로
--     두 정책을 제거한다. 커버 교체는 새 객체 INSERT 로 이뤄지고, 삭제/교체가 필요하면
--     소유권을 검증하는 service_role 서버 라우트로만 수행한다.
DROP POLICY IF EXISTS job_images_update ON storage.objects;
DROP POLICY IF EXISTS job_images_delete ON storage.objects;

-- #3: 공개 버킷에 MIME 화이트리스트 강제 — 클라 직접 업로드(job-images/avatars)가 이미지가 아닌
--     임의 파일/Content-Type 을 신뢰 스토리지 도메인에 올리지 못하게 한다.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
 WHERE id IN ('job-images','avatars');
