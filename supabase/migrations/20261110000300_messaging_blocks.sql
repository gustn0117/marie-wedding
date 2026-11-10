-- 쪽지에 이용자 차단(user_blocks) 반영. 어느 한쪽이라도 상대를 차단했으면 대화를 시작할 수도, 쪽지를 보낼 수도 없다.
-- 두 함수는 브라우저에서도 바로 부를 수 있어(authenticated EXECUTE) API 라우트가 아니라 여기서 막는다.
-- 함께 고침: 새 쪽지 알림에 원문(p_body) 대신 저장된 본문(금칙어를 가린 v_msg.body)을 싣는다.
-- 반환형·인자는 그대로라 배포 전환 중 이전 버전과 함께 돌아도 안전하다.

CREATE OR REPLACE FUNCTION marie_wedding.send_message(p_conversation_id uuid, p_body text)
 RETURNS marie_wedding.messages
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'marie_wedding', 'public'
AS $function$
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

  v_target := CASE WHEN v_caller = v_conv.participant_a THEN v_conv.participant_b ELSE v_conv.participant_a END;
  IF EXISTS (
    SELECT 1 FROM marie_wedding.user_blocks
    WHERE (blocker_id = v_caller AND blocked_id = v_target)
       OR (blocker_id = v_target AND blocked_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  INSERT INTO marie_wedding.messages(conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_caller, p_body)
  RETURNING * INTO v_msg;

  UPDATE marie_wedding.conversations SET last_message_at = NOW() WHERE id = p_conversation_id;

  SELECT COALESCE(company_name, contact_name, '상대') INTO v_sender_name
    FROM marie_wedding.profiles WHERE id = v_caller;

  INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
  VALUES (v_target, 'message_received', v_sender_name || '님의 새 메시지',
    SUBSTRING(v_msg.body, 1, 80), '/mypage/messages/' || p_conversation_id);

  RETURN v_msg;
END;
$function$;

CREATE OR REPLACE FUNCTION marie_wedding.start_conversation(p_other_profile_id uuid)
 RETURNS marie_wedding.conversations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_caller UUID;
  v_a UUID;
  v_b UUID;
  v_conv marie_wedding.conversations%ROWTYPE;
BEGIN
  SELECT id INTO v_caller FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF v_caller = p_other_profile_id THEN RAISE EXCEPTION 'cannot_message_self'; END IF;

  IF EXISTS (
    SELECT 1 FROM marie_wedding.user_blocks
    WHERE (blocker_id = v_caller AND blocked_id = p_other_profile_id)
       OR (blocker_id = p_other_profile_id AND blocked_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

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
$function$;
