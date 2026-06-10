-- 메인페이지 hero 영역 위 배너
CREATE TABLE IF NOT EXISTS marie_wedding.banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,           -- 관리용 라벨
  image_path_pc TEXT,            -- Storage 'banners' 버킷 내 경로
  image_path_mobile TEXT,        -- 모바일 전용
  link_url TEXT,                 -- 클릭 시 이동
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ,        -- 노출 시작
  valid_until TIMESTAMPTZ,       -- 노출 종료
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_banners_active_order
  ON marie_wedding.banners(is_active, display_order)
  WHERE deleted_at IS NULL;

-- updated_at 자동 갱신 헬퍼 (없으면 생성)
CREATE OR REPLACE FUNCTION marie_wedding.banners_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_banners_updated_at ON marie_wedding.banners;
CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON marie_wedding.banners
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.banners_set_updated_at();

ALTER TABLE marie_wedding.banners ENABLE ROW LEVEL SECURITY;

-- 공개 SELECT — 활성 + 기간 내
DROP POLICY IF EXISTS banners_public_select ON marie_wedding.banners;
CREATE POLICY banners_public_select ON marie_wedding.banners
  FOR SELECT USING (
    deleted_at IS NULL
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW())
  );

-- admin 전체 RW
DROP POLICY IF EXISTS banners_admin_all ON marie_wedding.banners;
CREATE POLICY banners_admin_all ON marie_wedding.banners
  FOR ALL USING (marie_wedding.is_admin())
  WITH CHECK (marie_wedding.is_admin());

-- Storage 버킷 (없으면 생성)
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책: public read
DROP POLICY IF EXISTS "banners_public_read" ON storage.objects;
CREATE POLICY "banners_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

-- Storage 정책: admin write (interactive 호출은 anon role이라 admin 함수로 검증)
DROP POLICY IF EXISTS "banners_admin_write" ON storage.objects;
CREATE POLICY "banners_admin_write"
  ON storage.objects FOR ALL
  USING (bucket_id = 'banners' AND marie_wedding.is_admin())
  WITH CHECK (bucket_id = 'banners' AND marie_wedding.is_admin());

NOTIFY pgrst, 'reload schema';
