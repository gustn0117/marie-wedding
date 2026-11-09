-- 공고자(공고 작성자)가 받은 지원을 확인한 기록 — 관리자 '지원 현황'(/admin/applications)에서 쓴다.
--
-- applications 에 열을 더하지 않고 표를 따로 둔다.
--  · applications 는 UPDATE 마다 updated_at 트리거가 돌고, 지원·상태 변경 RPC 가 행 전체(composite)를
--    돌려준다. 열을 더하면 지원자에게 가는 응답에 열람 정보가 섞일 수 있다.
--  · 브라우저 역할(anon/authenticated)은 이 표를 읽지도 쓰지도 못한다. 기록과 조회는 서버(service_role)만.
--
-- first_seen_at        공고자가 이 지원을 처음 본 시각(공고 페이지 지원자 목록·마이페이지 받은 지원 목록·지원서 상세 중 어디든)
-- last_seen_at         마지막으로 본 시각
-- detail_opened_at     지원서 상세(제출 이력서)를 처음 연 시각
-- detail_last_opened_at 지원서 상세를 마지막으로 연 시각
--
-- 새 표만 추가하므로 배포 전환 중 이전 버전과 함께 돌아도 안전하다.

BEGIN;

CREATE TABLE IF NOT EXISTS marie_wedding.application_views (
  application_id uuid PRIMARY KEY
    REFERENCES marie_wedding.applications(id) ON DELETE CASCADE,
  viewer_id uuid
    REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  detail_opened_at timestamptz,
  detail_last_opened_at timestamptz
);

ALTER TABLE marie_wedding.application_views ENABLE ROW LEVEL SECURITY;

-- 기본 권한(marie_wedding 의 새 표는 anon/authenticated 에도 ALL)이 붙으므로 걷어 낸다.
-- application_resume_snapshots 와 같은 방식: service_role(·소유자)만 접근.
REVOKE ALL ON TABLE marie_wedding.application_views FROM PUBLIC, anon, authenticated, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marie_wedding.application_views TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
