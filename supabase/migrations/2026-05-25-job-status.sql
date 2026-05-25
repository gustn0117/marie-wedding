-- 공고 상태 enum + 지원자 메모 + 사용자 제재 컬럼
-- 작성일: 2026-05-25

-- 1) applications.author_note (공고 작성자의 비공개 메모)
ALTER TABLE marie_wedding.applications
  ADD COLUMN IF NOT EXISTS author_note TEXT;

-- 2) jobs.status enum (모집중·마감임박·마감·채용완료·숨김)
DO $$ BEGIN
  CREATE TYPE marie_wedding.job_status AS ENUM ('open', 'urgent', 'closed', 'filled', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE marie_wedding.jobs
  ADD COLUMN IF NOT EXISTS status marie_wedding.job_status DEFAULT 'open' NOT NULL;

-- 기존 데이터 초기화 (deadline 기준)
UPDATE marie_wedding.jobs
SET status = (CASE
  WHEN deadline IS NOT NULL AND deadline < NOW() THEN 'closed'
  WHEN deadline IS NOT NULL AND deadline < NOW() + INTERVAL '3 days' THEN 'urgent'
  ELSE 'open'
END)::marie_wedding.job_status
WHERE status = 'open' AND deleted_at IS NULL;

-- 트리거: deadline 기반 자동 상태 갱신 (filled/hidden은 수동 유지)
CREATE OR REPLACE FUNCTION marie_wedding.refresh_job_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 수동 상태(filled/hidden)는 deadline 자동 갱신 대상 아님
  IF NEW.status IN ('filled', 'hidden') THEN
    RETURN NEW;
  END IF;

  IF NEW.deadline IS NOT NULL AND NEW.deadline < NOW() THEN
    NEW.status := 'closed';
  ELSIF NEW.deadline IS NOT NULL AND NEW.deadline < NOW() + INTERVAL '3 days' THEN
    NEW.status := 'urgent';
  ELSIF NEW.status NOT IN ('closed', 'urgent') THEN
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobs_status_refresh ON marie_wedding.jobs;
CREATE TRIGGER jobs_status_refresh
  BEFORE INSERT OR UPDATE OF deadline ON marie_wedding.jobs
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.refresh_job_status();

-- cron으로 호출할 일일 상태 새로고침 (deadline 경과 → closed 등)
CREATE OR REPLACE FUNCTION marie_wedding.refresh_all_job_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE marie_wedding.jobs
  SET status = 'closed'
  WHERE status NOT IN ('filled', 'hidden', 'closed')
    AND deadline IS NOT NULL
    AND deadline < NOW()
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE marie_wedding.jobs
  SET status = 'urgent'
  WHERE status = 'open'
    AND deadline IS NOT NULL
    AND deadline < NOW() + INTERVAL '3 days'
    AND deleted_at IS NULL;

  RETURN v_count;
END;
$$;

-- 3) 사용자 제재 컬럼
ALTER TABLE marie_wedding.profiles
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES marie_wedding.profiles(id);

CREATE INDEX IF NOT EXISTS idx_profiles_banned ON marie_wedding.profiles(banned_at) WHERE banned_at IS NOT NULL;

-- 4) 댓글 채택 (post.adopted_comment_id)
ALTER TABLE marie_wedding.posts
  ADD COLUMN IF NOT EXISTS adopted_comment_id UUID REFERENCES marie_wedding.comments(id) ON DELETE SET NULL;

-- 5) author_note 보호용 RPC (applicant가 author_note 임의 변경 못 하게)
CREATE OR REPLACE FUNCTION marie_wedding.set_author_note(p_application_id UUID, p_note TEXT)
RETURNS marie_wedding.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_app marie_wedding.applications%ROWTYPE;
  v_job marie_wedding.jobs%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_app FROM marie_wedding.applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = v_app.job_id;
  IF v_job.author_id <> v_caller THEN RAISE EXCEPTION 'not_author'; END IF;
  UPDATE marie_wedding.applications SET author_note = p_note WHERE id = p_application_id RETURNING * INTO v_app;
  RETURN v_app;
END;
$$;

NOTIFY pgrst, 'reload schema';
