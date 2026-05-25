-- 저장 검색 자동 매칭 알림 RPC + posts.region + 채용완료 자동 처리
-- 작성일: 2026-05-26

-- 1) posts.region (지역별 커뮤니티용)
ALTER TABLE marie_wedding.posts
  ADD COLUMN IF NOT EXISTS region TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_region ON marie_wedding.posts(region) WHERE deleted_at IS NULL;

-- 2) 저장 검색 — 새 매칭 jobs 알림
CREATE OR REPLACE FUNCTION marie_wedding.process_saved_search_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_count INTEGER := 0;
  s RECORD;
  v_new_count INTEGER;
  v_keyword TEXT;
  v_region TEXT;
  v_business_type TEXT;
  v_link TEXT;
BEGIN
  FOR s IN
    SELECT * FROM marie_wedding.saved_searches WHERE scope = 'jobs'
  LOOP
    v_keyword := NULLIF(s.query->>'search', '');
    v_region := NULLIF(s.query->>'region', '');
    v_business_type := NULLIF(s.query->>'businessType', '');

    SELECT COUNT(*) INTO v_new_count
    FROM marie_wedding.jobs j
    WHERE j.deleted_at IS NULL
      AND j.hidden_by_admin = FALSE
      AND j.created_at > COALESCE(s.last_checked_at, s.created_at)
      AND (v_keyword IS NULL OR j.title ILIKE '%' || v_keyword || '%' OR j.description ILIKE '%' || v_keyword || '%')
      AND (v_region IS NULL OR j.region ILIKE '%' || v_region || '%')
      AND (v_business_type IS NULL OR j.business_type ILIKE '%' || v_business_type || '%');

    IF v_new_count > 0 THEN
      v_link := '/jobs';
      IF v_keyword IS NOT NULL THEN v_link := v_link || '?search=' || v_keyword; END IF;

      INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
      VALUES (s.profile_id, 'saved_search_match',
        '저장한 검색에 새 공고가 있어요',
        '"' || s.name || '" 조건에 맞는 새 공고 ' || v_new_count || '건이 등록되었습니다.',
        v_link);
      v_count := v_count + 1;
    END IF;

    UPDATE marie_wedding.saved_searches
    SET last_checked_at = NOW()
    WHERE id = s.id;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 3) 채용 완료 자동 처리 RPC — 작성자가 호출하면 양쪽 거래 완료 application이 있을 경우 jobs.status='filled'로 변경
CREATE OR REPLACE FUNCTION marie_wedding.mark_job_filled(p_job_id UUID)
RETURNS marie_wedding.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_job marie_wedding.jobs%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;
  IF v_job.author_id <> v_caller THEN RAISE EXCEPTION 'not_author'; END IF;

  UPDATE marie_wedding.jobs SET status = 'filled' WHERE id = p_job_id RETURNING * INTO v_job;
  RETURN v_job;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- pg_cron 등록 예시:
--   SELECT cron.schedule('saved-search-match', '0 9 * * *', $$ SELECT marie_wedding.process_saved_search_notifications(); $$);
