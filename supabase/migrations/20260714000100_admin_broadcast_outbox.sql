-- 관리자 대량 메일: 네트워크 재시도에도 같은 수신자에게 중복 발송하지 않는 durable outbox.

BEGIN;

CREATE TABLE IF NOT EXISTS marie_wedding.admin_broadcast_campaigns (
  id UUID PRIMARY KEY,
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 120),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  target TEXT NOT NULL CHECK (target IN ('all', 'business', 'individual')),
  recipients_ready BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS marie_wedding.admin_broadcast_deliveries (
  campaign_id UUID NOT NULL REFERENCES marie_wedding.admin_broadcast_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'uncertain')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_id TEXT,
  error TEXT,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  PRIMARY KEY (campaign_id, user_id)
);

-- 파일이 이미 일부 환경에 적용된 뒤 재실행되는 경우에도 uncertain 상태를
-- 허용한다. provider 전송과 DB 상태 기록 사이에 프로세스가 죽은 행은 중복을
-- 피하기 위해 재전송하지 않고 이 terminal 상태로 회수한다.
ALTER TABLE marie_wedding.admin_broadcast_deliveries
  DROP CONSTRAINT IF EXISTS admin_broadcast_deliveries_status_check;
ALTER TABLE marie_wedding.admin_broadcast_deliveries
  ADD CONSTRAINT admin_broadcast_deliveries_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'uncertain'));

CREATE INDEX IF NOT EXISTS idx_admin_broadcast_delivery_queue
  ON marie_wedding.admin_broadcast_deliveries(campaign_id, status, user_id);

CREATE INDEX IF NOT EXISTS idx_admin_broadcast_stale_claims
  ON marie_wedding.admin_broadcast_deliveries(campaign_id, claimed_at)
  WHERE status = 'sending';

ALTER TABLE marie_wedding.admin_broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.admin_broadcast_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE marie_wedding.admin_broadcast_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE marie_wedding.admin_broadcast_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE marie_wedding.admin_broadcast_campaigns TO service_role;
GRANT ALL ON TABLE marie_wedding.admin_broadcast_deliveries TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
