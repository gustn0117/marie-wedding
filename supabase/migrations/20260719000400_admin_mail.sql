-- 관리자 메일함 (admin@marie.co.kr 송수신 저장) — sweep 이후 기능요청
-- 작성일: 2026-07-19
--
-- 수신: Cloudflare Email Routing → Email Worker → /api/mail/inbound → 이 테이블(inbound).
-- 발송: 관리자 페이지 → /api/admin/mail (send) → Postfix SMTP + 이 테이블(outbound) 사본.
-- 접근: RLS 켜고 정책 없음 → service_role(관리자 라우트) 전용. 일반 사용자 접근 불가.

CREATE TABLE IF NOT EXISTS marie_wedding.admin_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_addr text NOT NULL,
  to_addr text NOT NULL,
  subject text,
  body_text text,
  body_html text,
  message_id text,
  in_reply_to text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_mail_dir_created
  ON marie_wedding.admin_mail(direction, created_at DESC);

ALTER TABLE marie_wedding.admin_mail ENABLE ROW LEVEL SECURITY;
-- 정책을 두지 않는다 → service_role 만 접근. anon/authenticated 는 읽기/쓰기 불가.

NOTIFY pgrst, 'reload schema';
