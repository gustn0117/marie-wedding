-- Social login (Kakao/Naver/Google/Apple) — schema migration
-- 2026-06-19
--
-- 변경 사항:
-- 1. profiles.account_type / region NULL 허용 (OAuth 가입 직후 미선택 상태 허용)
-- 2. profiles.signup_provider, onboarded_at, naver_sub 컬럼 추가
-- 3. 기존 사용자 backfill: account_type이 채워진 row는 onboarded_at = 기존 시각으로 시드
-- 4. RLS: jobs/posts/applications/comments INSERT/UPDATE에 onboarded_at 가드 추가

SET search_path = marie_wedding, public;

------------------------------------------------------------------------
-- 1. profiles 스키마 변경
------------------------------------------------------------------------

ALTER TABLE marie_wedding.profiles
  ALTER COLUMN account_type DROP NOT NULL,
  ALTER COLUMN region DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS signup_provider TEXT,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS naver_sub TEXT;

-- signup_provider 값 제약
ALTER TABLE marie_wedding.profiles
  DROP CONSTRAINT IF EXISTS profiles_signup_provider_check,
  ADD CONSTRAINT profiles_signup_provider_check
    CHECK (signup_provider IS NULL OR signup_provider IN ('email','kakao','google','apple','naver'));

-- 네이버 sub는 unique (한 네이버 계정 = 한 marie 계정)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_naver_sub_key
  ON marie_wedding.profiles(naver_sub)
  WHERE naver_sub IS NOT NULL;

-- 미들웨어가 자주 select할 컬럼
CREATE INDEX IF NOT EXISTS profiles_onboarded_at_idx
  ON marie_wedding.profiles(onboarded_at);

------------------------------------------------------------------------
-- 2. 기존 사용자 backfill
--    이미 account_type이 채워진 사용자는 온보딩 완료 상태로 시드
------------------------------------------------------------------------

UPDATE marie_wedding.profiles
SET onboarded_at = COALESCE(updated_at, created_at, NOW()),
    signup_provider = COALESCE(signup_provider, 'email')
WHERE account_type IS NOT NULL
  AND onboarded_at IS NULL;

------------------------------------------------------------------------
-- 3. RLS 헬퍼 함수: 현재 사용자가 온보딩 완료했는지
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION marie_wedding.is_onboarded()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = marie_wedding, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM marie_wedding.profiles
    WHERE user_id = auth.uid()
      AND onboarded_at IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION marie_wedding.is_onboarded() TO authenticated;

------------------------------------------------------------------------
-- 4. RLS 정책 강화: 주요 쓰기 작업에 onboarded_at IS NOT NULL 가드 추가
--    (정책 이름은 기존 컨벤션을 따르되, 운영 시 실제 정책 이름은 마이그레이션 적용 전에 확인 필요)
------------------------------------------------------------------------

DO $$
BEGIN
  -- jobs: 채용 공고 작성
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'marie_wedding' AND tablename = 'jobs' AND policyname = 'jobs_insert_own') THEN
    EXECUTE 'DROP POLICY jobs_insert_own ON marie_wedding.jobs';
  END IF;
  EXECUTE $POL$
    CREATE POLICY jobs_insert_own ON marie_wedding.jobs
      FOR INSERT TO authenticated
      WITH CHECK (
        author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
        AND marie_wedding.is_onboarded()
      )
  $POL$;

  -- posts: 커뮤니티 글 작성
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'marie_wedding' AND tablename = 'posts' AND policyname = 'posts_insert_own') THEN
    EXECUTE 'DROP POLICY posts_insert_own ON marie_wedding.posts';
  END IF;
  EXECUTE $POL$
    CREATE POLICY posts_insert_own ON marie_wedding.posts
      FOR INSERT TO authenticated
      WITH CHECK (
        author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
        AND marie_wedding.is_onboarded()
      )
  $POL$;

  -- applications: 채용 지원
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'marie_wedding' AND tablename = 'applications' AND policyname = 'applications_insert_own') THEN
    EXECUTE 'DROP POLICY applications_insert_own ON marie_wedding.applications';
  END IF;
  EXECUTE $POL$
    CREATE POLICY applications_insert_own ON marie_wedding.applications
      FOR INSERT TO authenticated
      WITH CHECK (
        applicant_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
        AND marie_wedding.is_onboarded()
      )
  $POL$;

  -- comments: 댓글
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'marie_wedding' AND tablename = 'comments' AND policyname = 'comments_insert_own') THEN
    EXECUTE 'DROP POLICY comments_insert_own ON marie_wedding.comments';
  END IF;
  EXECUTE $POL$
    CREATE POLICY comments_insert_own ON marie_wedding.comments
      FOR INSERT TO authenticated
      WITH CHECK (
        author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid())
        AND marie_wedding.is_onboarded()
      )
  $POL$;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Some target tables do not exist yet — skipping RLS update for missing tables';
  WHEN OTHERS THEN
    RAISE NOTICE 'RLS policy update encountered: %', SQLERRM;
END $$;

------------------------------------------------------------------------
-- 5. 확인
------------------------------------------------------------------------

DO $$
DECLARE
  total INT;
  onboarded INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE onboarded_at IS NOT NULL)
  INTO total, onboarded
  FROM marie_wedding.profiles;
  RAISE NOTICE 'profiles total=%, onboarded=%', total, onboarded;
END $$;
