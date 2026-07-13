-- ===================================================================
-- hardening(22): 1,000 동시접속 대비 핫 리스트 쿼리 부분 복합 인덱스
-- ===================================================================
-- 현재 테이블은 작아 seq scan 이 더 빠르므로 미사용이지만, 데이터가 커지면
-- 목록/정렬 쿼리의 핵심 인덱스가 된다. 부분 인덱스라 인덱스 크기·쓰기 비용도 최소.

-- 공고 목록 기본 뷰: 활성 채용공고를 최신순 — /jobs, 홈 최신공고
CREATE INDEX IF NOT EXISTS idx_jobs_list_active
  ON marie_wedding.jobs (created_at DESC)
  WHERE deleted_at IS NULL AND hidden_by_admin = false
    AND status <> 'hidden' AND posting_type = 'hiring';

-- 인기 공고(featured) — 홈/추천
CREATE INDEX IF NOT EXISTS idx_jobs_featured_active
  ON marie_wedding.jobs (featured_order ASC, featured_at DESC)
  WHERE deleted_at IS NULL AND featured_at IS NOT NULL
    AND hidden_by_admin = false AND status <> 'hidden';

-- 마감 임박/미마감 필터 — 마감일 오름차순
CREATE INDEX IF NOT EXISTS idx_jobs_deadline_active
  ON marie_wedding.jobs (deadline ASC)
  WHERE deleted_at IS NULL AND hidden_by_admin = false
    AND status <> 'hidden' AND posting_type = 'hiring' AND deadline IS NOT NULL;

-- 게시글 목록 최신순 — /community
CREATE INDEX IF NOT EXISTS idx_posts_list_active
  ON marie_wedding.posts (created_at DESC)
  WHERE deleted_at IS NULL;

-- 게시글 카테고리별 최신순
CREATE INDEX IF NOT EXISTS idx_posts_category_active
  ON marie_wedding.posts (category, created_at DESC)
  WHERE deleted_at IS NULL;

-- 업체 디렉토리 목록 — 공개 프로필 가나다순
CREATE INDEX IF NOT EXISTS idx_profiles_directory_active
  ON marie_wedding.profiles (company_name ASC)
  WHERE deleted_at IS NULL AND is_directory_listed = true;

-- 프로필 정렬(프리미엄→진행이력→인증→가나다) 목록 커버
CREATE INDEX IF NOT EXISTS idx_profiles_directory_rank
  ON marie_wedding.profiles (premium_tier DESC, completed_deals_count DESC, verified_at DESC NULLS LAST, company_name ASC)
  WHERE deleted_at IS NULL AND is_directory_listed = true;

-- 알림 미읽음 카운트 (수신자별)
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON marie_wedding.notifications (profile_id)
  WHERE read_at IS NULL;

-- 다가오는 행사 — 종료 안된 행사
CREATE INDEX IF NOT EXISTS idx_events_upcoming
  ON marie_wedding.events (is_pinned DESC, start_date ASC)
  WHERE deleted_at IS NULL;
