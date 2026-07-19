-- 수신확인 오픈 트래킹 — 추적 픽셀 로드 시 열람 기록(원자적 증가). service_role 전용.
-- 작성일: 2026-07-20 (CREATE FUNCTION 은 pg-meta WAF 차단이라 서버 psql 로 적용)

CREATE OR REPLACE FUNCTION marie_wedding.mail_track_open(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  UPDATE marie_wedding.admin_mail
     SET open_count = open_count + 1,
         opened_at = COALESCE(opened_at, now())
   WHERE id = p_id AND direction = 'outbound';
$$;

REVOKE ALL ON FUNCTION marie_wedding.mail_track_open(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marie_wedding.mail_track_open(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
