-- 공고 재오픈 버그 수정 (sweep v3 #5) + 수동 마감 보존 (적대검토 2회차 반영)
-- 작성일: 2026-07-19
--
-- 문제(#5): 마감일 경과로 자동 closed 된 공고를 '수정'에서 마감일만 미래로 바꿔도 status 가
--           closed 로 남아 목록엔 뜨는데 지원이 막혔다(재오픈 불가).
-- 함정: 반대로 사장이 명시적으로 조기 마감(status 메뉴 → closed, 마감일은 미래/상시)한 공고는
--       이후 아무 필드나 수정 저장해도(write 라우트가 deadline 을 매번 SET → 트리거 발화)
--       open/urgent 로 되돌아가면 안 된다.
--
-- 해결: '자동 마감'과 '수동 마감'을 OLD 상태로 구분한다.
--   - 직전이 이미 closed 이고 그때 마감일이 미래/상시(OLD.deadline >= NOW() 또는 NULL)였다면
--     = 사장이 명시적으로 건 마감 → deadline 을 건드려도 closed 를 보존(자동계산보다 우선).
--   - 그 외(직전 마감일이 이미 경과 = 자동 마감이었던 경우 포함)는 NEW.deadline 기준으로 재산정.
--     따라서 자동 마감 공고를 미래 마감일로 연장하면 open 으로 재오픈된다.
--   filled/hidden 은 최상단에서 보존.

CREATE OR REPLACE FUNCTION marie_wedding.refresh_job_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 수동 상태(filled/hidden)는 deadline 자동 갱신 대상 아님
  IF NEW.status IN ('filled', 'hidden') THEN
    RETURN NEW;
  END IF;

  -- 수동 마감(closed) 보존 — deadline 기반 자동 산정보다 우선.
  -- 직전이 closed 이고 그때 마감일이 미래/상시였다면(경과 전 명시적 마감) 그대로 유지한다.
  IF TG_OP = 'UPDATE' AND OLD.status = 'closed'
     AND (OLD.deadline IS NULL OR OLD.deadline >= NOW()) THEN
    NEW.status := 'closed';
    RETURN NEW;
  END IF;

  -- deadline 기반 자동 산정
  IF NEW.deadline IS NOT NULL AND NEW.deadline < NOW() THEN
    NEW.status := 'closed';
  ELSIF NEW.deadline IS NOT NULL AND NEW.deadline < NOW() + INTERVAL '3 days' THEN
    NEW.status := 'urgent';
  ELSE
    -- 미래(3일 초과) 마감일 또는 상시 → open (자동 마감됐던 공고의 마감일 연장 시 재오픈 포함)
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
