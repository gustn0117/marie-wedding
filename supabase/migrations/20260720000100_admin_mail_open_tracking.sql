-- 관리자 메일 수신확인(오픈 트래킹) — 발송 메일에 추적 픽셀을 심고 열람 시각 기록
-- 작성일: 2026-07-20

ALTER TABLE marie_wedding.admin_mail
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
