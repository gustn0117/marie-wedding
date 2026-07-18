-- profiles.featured_at/featured_order 는 운영 DB 에만 존재하고 canonical schema/migration
-- 어디에도 정의가 없었다(추천 프로필 지정용). 없으면 fresh/DR DB 에서 디렉토리·홈 SSR
-- 쿼리(PUBLIC_PROFILE_COLUMNS·featured 정렬)가 PostgREST 42703(undefined column)으로 실패한다.
-- 운영 정의를 명시 마이그레이션으로 승격한다(ADD COLUMN IF NOT EXISTS 라 운영에선 no-op).
ALTER TABLE marie_wedding.profiles
  ADD COLUMN IF NOT EXISTS featured_at timestamptz,
  ADD COLUMN IF NOT EXISTS featured_order integer;

CREATE INDEX IF NOT EXISTS idx_profiles_featured
  ON marie_wedding.profiles (featured_order, featured_at DESC)
  WHERE featured_at IS NOT NULL AND deleted_at IS NULL;
