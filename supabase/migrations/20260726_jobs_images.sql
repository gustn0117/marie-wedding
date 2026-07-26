-- 공고 추가 사진(갤러리) — storage 경로 배열. 최대 8장은 앱/API 에서 강제한다.
-- 컬럼 추가만 하므로 blue/green 배포 중 구버전이 함께 떠 있어도 안전하다(기존 공고는 NULL).
ALTER TABLE marie_wedding.jobs ADD COLUMN IF NOT EXISTS images text[];
