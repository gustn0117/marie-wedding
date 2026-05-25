-- 관리자 메모 + 위험 키워드 자동 모더레이션
-- 작성일: 2026-05-26

-- profiles 관리자 메모 (운영자만 보임)
ALTER TABLE marie_wedding.profiles
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- moderation_keywords: 자동 모더레이션 단어 리스트
CREATE TABLE IF NOT EXISTS marie_wedding.moderation_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope IN ('job', 'post', 'comment', 'all')),
  action TEXT NOT NULL CHECK (action IN ('hide', 'flag')),
  created_by UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_keywords_scope ON marie_wedding.moderation_keywords(scope);

ALTER TABLE marie_wedding.moderation_keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS moderation_keywords_admin_all ON marie_wedding.moderation_keywords;
CREATE POLICY moderation_keywords_admin_all ON marie_wedding.moderation_keywords
  FOR ALL USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

-- 새 공고가 위험 키워드를 포함하면 자동 hidden_by_admin = TRUE
CREATE OR REPLACE FUNCTION marie_wedding.auto_moderate_job()
RETURNS TRIGGER AS $$
DECLARE
  v_hit BOOLEAN := FALSE;
  v_kw RECORD;
  v_haystack TEXT;
BEGIN
  v_haystack := lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  FOR v_kw IN
    SELECT * FROM marie_wedding.moderation_keywords
    WHERE (scope = 'job' OR scope = 'all') AND action = 'hide'
  LOOP
    IF position(lower(v_kw.keyword) IN v_haystack) > 0 THEN
      v_hit := TRUE; EXIT;
    END IF;
  END LOOP;
  IF v_hit THEN
    NEW.hidden_by_admin := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS jobs_auto_moderate ON marie_wedding.jobs;
CREATE TRIGGER jobs_auto_moderate
  BEFORE INSERT OR UPDATE OF title, description ON marie_wedding.jobs
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.auto_moderate_job();

-- 새 글이 위험 키워드를 포함하면 자동 deleted_at = NOW() (또는 hide 별도 컬럼?)
-- posts에는 hidden_by_admin 없으니 단순화: deleted_at으로 처리
CREATE OR REPLACE FUNCTION marie_wedding.auto_moderate_post()
RETURNS TRIGGER AS $$
DECLARE
  v_hit BOOLEAN := FALSE;
  v_kw RECORD;
  v_haystack TEXT;
BEGIN
  v_haystack := lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, ''));
  FOR v_kw IN
    SELECT * FROM marie_wedding.moderation_keywords
    WHERE (scope = 'post' OR scope = 'all') AND action = 'hide'
  LOOP
    IF position(lower(v_kw.keyword) IN v_haystack) > 0 THEN
      v_hit := TRUE; EXIT;
    END IF;
  END LOOP;
  IF v_hit AND NEW.deleted_at IS NULL THEN
    NEW.deleted_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS posts_auto_moderate ON marie_wedding.posts;
CREATE TRIGGER posts_auto_moderate
  BEFORE INSERT OR UPDATE OF title, content ON marie_wedding.posts
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.auto_moderate_post();

NOTIFY pgrst, 'reload schema';
