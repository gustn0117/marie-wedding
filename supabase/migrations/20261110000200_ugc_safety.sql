-- 이용자 안전 장치 — iOS 앱 앱스토어 심사 기준 1.2(이용자 생성 콘텐츠)에 맞춘다.
--  ① 이용자 차단(user_blocks): 차단한 사람의 글·댓글이 안 보이고, 서로 쪽지를 주고받을 수 없다.
--  ② 약관 동의 시각(profiles.terms_agreed_at): 가입·온보딩에서 이용약관(부적절한 콘텐츠 무관용 조항 포함) 동의를 받는다.
--  ③ 금칙어: 글·공고에만 있던 자동 숨김(moderation_keywords)을 댓글에도 걸고, 쪽지는 금칙어를 ***로 가린다.
--  ④ 기본 금칙어: 비어 있던 moderation_keywords 에 오탐이 적은 심한 욕설만 넣는다(관리자 화면에서 고칠 수 있다).
--
-- 표·열·트리거를 더하기만 하므로 배포 전환 중 이전 버전과 함께 돌아도 안전하다.

BEGIN;

-- ① 이용자 차단 -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marie_wedding.user_blocks (
  blocker_id uuid NOT NULL REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);
-- '누가 나를 차단했나'(쪽지 막기)를 빨리 찾는다
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON marie_wedding.user_blocks (blocked_id);

ALTER TABLE marie_wedding.user_blocks ENABLE ROW LEVEL SECURITY;
-- 브라우저 역할은 읽지도 쓰지도 못한다. 읽기·쓰기는 서버(/api/blocks, service_role)만.
REVOKE ALL ON TABLE marie_wedding.user_blocks FROM PUBLIC, anon, authenticated, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marie_wedding.user_blocks TO service_role;

-- ② 약관 동의 시각 -------------------------------------------------------------------------------
ALTER TABLE marie_wedding.profiles ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz;

-- ③ 댓글 금칙어 자동 숨김 — 글(auto_moderate_post)과 같은 규칙: 걸리면 숨김(deleted_at) -------------------
CREATE OR REPLACE FUNCTION marie_wedding.auto_moderate_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_matched_keyword text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.content IS NOT DISTINCT FROM OLD.content THEN
    RETURN NEW;
  END IF;

  SELECT keyword INTO v_matched_keyword
  FROM marie_wedding.moderation_keywords
  WHERE scope IN ('comment', 'all')
    AND action = 'hide'
    AND position(lower(keyword) IN lower(coalesce(NEW.content, ''))) > 0
  LIMIT 1;

  IF v_matched_keyword IS NOT NULL THEN
    NEW.deleted_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS comments_auto_moderate ON marie_wedding.comments;
CREATE TRIGGER comments_auto_moderate
  BEFORE INSERT OR UPDATE OF content ON marie_wedding.comments
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.auto_moderate_comment();

-- 쪽지 금칙어 가림 — 1:1 대화라 숨기지 않고 그 낱말만 *** 로 바꾼다 ---------------------------------
CREATE OR REPLACE FUNCTION marie_wedding.mask_message_keywords()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.body IS NULL OR NEW.body = '' THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT keyword FROM marie_wedding.moderation_keywords
    WHERE scope = 'all' AND action = 'hide' AND keyword <> ''
  LOOP
    IF position(lower(r.keyword) IN lower(NEW.body)) > 0 THEN
      -- 정규식 특수문자를 이스케이프해 낱말 그대로 찾는다(대소문자 무시)
      NEW.body := regexp_replace(
        NEW.body,
        regexp_replace(r.keyword, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g'),
        repeat('*', char_length(r.keyword)),
        'gi'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS messages_mask_keywords ON marie_wedding.messages;
CREATE TRIGGER messages_mask_keywords
  BEFORE INSERT ON marie_wedding.messages
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.mask_message_keywords();

-- ④ 기본 금칙어(심한 욕설만) — 오탐 때문에 넣지 않은 것: 시발(시발점), 등신(등신대), 개년(3개년), 보지·자지(보지 마세요) 등
INSERT INTO marie_wedding.moderation_keywords (keyword, scope, action) VALUES
  ('씨발', 'all', 'hide'), ('씨빨', 'all', 'hide'), ('씨팔', 'all', 'hide'), ('씨바', 'all', 'hide'),
  ('씨벌', 'all', 'hide'), ('쓰발', 'all', 'hide'), ('시팔', 'all', 'hide'), ('ㅆㅂ', 'all', 'hide'),
  ('ㅅㅂ', 'all', 'hide'), ('ㅄ', 'all', 'hide'), ('ㅂㅅ', 'all', 'hide'), ('병신', 'all', 'hide'),
  ('븅신', 'all', 'hide'), ('빙신', 'all', 'hide'), ('좆', 'all', 'hide'), ('존나', 'all', 'hide'),
  ('개새끼', 'all', 'hide'), ('개새기', 'all', 'hide'), ('개색기', 'all', 'hide'), ('개색끼', 'all', 'hide'),
  ('개세끼', 'all', 'hide'), ('개쉐이', 'all', 'hide'), ('지랄', 'all', 'hide'), ('염병', 'all', 'hide'),
  ('엠창', 'all', 'hide'), ('니애미', 'all', 'hide'), ('느금마', 'all', 'hide'), ('니미럴', 'all', 'hide'),
  ('니기미', 'all', 'hide'), ('썅년', 'all', 'hide'), ('썅놈', 'all', 'hide'), ('미친년', 'all', 'hide'),
  ('미친놈', 'all', 'hide'), ('창녀', 'all', 'hide'), ('걸레년', 'all', 'hide'), ('호로새끼', 'all', 'hide'),
  ('후레자식', 'all', 'hide'), ('섹스', 'all', 'hide')
ON CONFLICT (keyword) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
