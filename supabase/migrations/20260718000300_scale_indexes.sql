-- 확장성 감사 결과: 성장 시 병목이 될 쿼리에 대한 커버링 인덱스(순수 추가·하위호환).
-- CONCURRENTLY 로 무잠금 생성(blue/green 스왑·라이브 트래픽 안전).

-- 1) /jobs 기본 목록 정렬(is_promoted DESC, created_at DESC). 기존엔 이 조합 인덱스가
--    없어 활성공고 풀스캔+Sort. 부분조건은 목록 쿼리 필터와 일치시켜 LIMIT push-down.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_list_promoted_created
  ON marie_wedding.jobs (is_promoted DESC, created_at DESC)
  WHERE deleted_at IS NULL
    AND hidden_by_admin = false
    AND status <> 'hidden'::marie_wedding.job_status
    AND posting_type = 'hiring'::marie_wedding.posting_type;

-- 2) 이력서 PDF 첨부 열람 인가가 snapshot @> {attachments:[{path}]} 컨테인먼트라
--    GIN 없으면 열람마다 application_resume_snapshots 전체 Seq Scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_snapshots_snapshot_gin
  ON marie_wedding.application_resume_snapshots
  USING gin (snapshot jsonb_path_ops);

-- 3) 디렉토리/통합검색의 이름 검색(contact_name ILIKE '%..%')이 trgm 인덱스 없어
--    profiles 순차 스캔. 다른 검색 컬럼(company_name/bio)엔 이미 trgm 있음.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_contact_name_trgm
  ON marie_wedding.profiles USING gin (contact_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- 4) 대화목록 OR 브랜치(participant_b = me)에 단독 인덱스가 없어 풀스캔 위험.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_participant_b
  ON marie_wedding.conversations (participant_b, last_message_at DESC);
