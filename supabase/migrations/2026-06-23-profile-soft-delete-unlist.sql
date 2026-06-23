-- 소프트 삭제된 프로필이 디렉토리에 노출되는 인콘시스턴시 방지.
-- 기존 deleted_at IS NOT NULL 인데 is_directory_listed=true 인 row 정리,
-- + deleted_at가 새로 채워질 때 자동으로 is_directory_listed=false 만드는 트리거.

-- 1) 데이터 정리
UPDATE marie_wedding.profiles
   SET is_directory_listed = false
 WHERE is_directory_listed = true
   AND deleted_at IS NOT NULL;

-- 2) 트리거 함수
CREATE OR REPLACE FUNCTION marie_wedding.auto_unlist_on_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    NEW.is_directory_listed := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) 트리거 부착
DROP TRIGGER IF EXISTS trg_auto_unlist_on_soft_delete ON marie_wedding.profiles;
CREATE TRIGGER trg_auto_unlist_on_soft_delete
  BEFORE UPDATE ON marie_wedding.profiles
  FOR EACH ROW
  EXECUTE FUNCTION marie_wedding.auto_unlist_on_soft_delete();

COMMENT ON FUNCTION marie_wedding.auto_unlist_on_soft_delete() IS
  'profiles.deleted_at가 NULL→NOT NULL로 전환되면 is_directory_listed=false 자동 처리.';
