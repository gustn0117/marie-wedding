-- 플랫폼 강화 3차: 가용 캘린더 + DM/메시지
-- 작성일: 2026-05-25

-- 1) availability_slots
CREATE TABLE IF NOT EXISTS marie_wedding.availability_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'busy')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_availability_profile_date
  ON marie_wedding.availability_slots(profile_id, date);

DROP TRIGGER IF EXISTS availability_updated_at ON marie_wedding.availability_slots;
CREATE TRIGGER availability_updated_at
  BEFORE UPDATE ON marie_wedding.availability_slots
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

ALTER TABLE marie_wedding.availability_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS availability_select_all ON marie_wedding.availability_slots;
CREATE POLICY availability_select_all ON marie_wedding.availability_slots
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS availability_write_own ON marie_wedding.availability_slots;
CREATE POLICY availability_write_own ON marie_wedding.availability_slots
  FOR ALL USING (
    profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  ) WITH CHECK (
    profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  );

-- 2) conversations & messages (DM)
CREATE TABLE IF NOT EXISTS marie_wedding.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_a UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  participant_b UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT conversations_ordered CHECK (participant_a < participant_b),
  UNIQUE (participant_a, participant_b)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON marie_wedding.conversations(participant_a, participant_b);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON marie_wedding.conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS marie_wedding.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES marie_wedding.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON marie_wedding.messages(conversation_id, created_at);

ALTER TABLE marie_wedding.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select_participant ON marie_wedding.conversations;
CREATE POLICY conversations_select_participant ON marie_wedding.conversations
  FOR SELECT USING (
    participant_a IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    OR participant_b IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    OR marie_wedding.is_admin()
  );

DROP POLICY IF EXISTS messages_select_participant ON marie_wedding.messages;
CREATE POLICY messages_select_participant ON marie_wedding.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM marie_wedding.conversations
      WHERE participant_a IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
         OR participant_b IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    )
    OR marie_wedding.is_admin()
  );

DROP POLICY IF EXISTS messages_update_read ON marie_wedding.messages;
CREATE POLICY messages_update_read ON marie_wedding.messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT id FROM marie_wedding.conversations
      WHERE participant_a IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
         OR participant_b IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- 대화 시작 RPC: 정렬해 UNIQUE 보장
CREATE OR REPLACE FUNCTION marie_wedding.start_conversation(p_other_profile_id UUID)
RETURNS marie_wedding.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_a UUID;
  v_b UUID;
  v_conv marie_wedding.conversations%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF v_caller = p_other_profile_id THEN RAISE EXCEPTION 'cannot_message_self'; END IF;

  IF v_caller < p_other_profile_id THEN
    v_a := v_caller; v_b := p_other_profile_id;
  ELSE
    v_a := p_other_profile_id; v_b := v_caller;
  END IF;

  SELECT * INTO v_conv FROM marie_wedding.conversations WHERE participant_a = v_a AND participant_b = v_b;
  IF NOT FOUND THEN
    INSERT INTO marie_wedding.conversations(participant_a, participant_b) VALUES (v_a, v_b) RETURNING * INTO v_conv;
  END IF;
  RETURN v_conv;
END;
$$;

-- 메시지 전송 RPC: 본인이 참여자인지 검증
CREATE OR REPLACE FUNCTION marie_wedding.send_message(p_conversation_id UUID, p_body TEXT)
RETURNS marie_wedding.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_caller UUID;
  v_conv marie_wedding.conversations%ROWTYPE;
  v_msg marie_wedding.messages%ROWTYPE;
  v_target UUID;
  v_sender_name TEXT;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF length(trim(p_body)) = 0 OR length(p_body) > 2000 THEN RAISE EXCEPTION 'invalid_body'; END IF;

  SELECT * INTO v_conv FROM marie_wedding.conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_caller <> v_conv.participant_a AND v_caller <> v_conv.participant_b THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  INSERT INTO marie_wedding.messages(conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_caller, p_body)
  RETURNING * INTO v_msg;

  UPDATE marie_wedding.conversations SET last_message_at = NOW() WHERE id = p_conversation_id;

  v_target := CASE WHEN v_caller = v_conv.participant_a THEN v_conv.participant_b ELSE v_conv.participant_a END;
  SELECT COALESCE(company_name, contact_name, '상대') INTO v_sender_name
    FROM marie_wedding.profiles WHERE id = v_caller;

  INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
  VALUES (v_target, 'message_received', v_sender_name || '님의 새 메시지',
    SUBSTRING(p_body, 1, 80), '/mypage/messages/' || p_conversation_id);

  RETURN v_msg;
END;
$$;

NOTIFY pgrst, 'reload schema';
