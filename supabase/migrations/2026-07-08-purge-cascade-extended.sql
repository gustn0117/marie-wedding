-- ===================================================================
-- hardening(6): 회원 탈퇴 cascade 확장 — 사용자 소유 부속 테이블까지 완전 삭제
-- ===================================================================
-- 문제: 탈퇴 → 재로그인 시 이전 bookmarks/saved_searches/availability_slots/
--       verifications 데이터 잔존. 사용자에게 "이전 데이터가 남아있어" 로 인식됨.
-- 해결: purge_profile_cascade 에 위 4개 테이블을 hard-delete 로 추가.
--       (2-party 데이터인 messages/conversations 은 유지 — 상대방 관점)
-- ===================================================================

CREATE OR REPLACE FUNCTION marie_wedding.purge_profile_cascade(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
DECLARE
  v_now timestamptz := NOW();
BEGIN
  PERFORM set_config('marie_wedding.system_context', 'on', true);

  -- 1) profile 본체
  UPDATE marie_wedding.profiles
     SET deleted_at = COALESCE(deleted_at, v_now),
         is_directory_listed = false
   WHERE id = p_profile_id;

  -- 2) 작성 콘텐츠 (soft delete)
  UPDATE marie_wedding.jobs
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  UPDATE marie_wedding.posts
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  UPDATE marie_wedding.comments
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE author_id = p_profile_id;

  -- 3) 지원 이력 (soft delete)
  UPDATE marie_wedding.applications
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE applicant_id = p_profile_id;

  -- 4) 리뷰 (양방향, soft delete)
  UPDATE marie_wedding.reviews
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE reviewer_id = p_profile_id
      OR reviewee_id = p_profile_id;

  -- 5) 포트폴리오 (soft delete)
  UPDATE marie_wedding.portfolios
     SET deleted_at = COALESCE(deleted_at, v_now)
   WHERE profile_id = p_profile_id;

  -- 6) 알림 (hard delete — 개인 데이터, 공유 소유권 없음)
  BEGIN
    DELETE FROM marie_wedding.notifications WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- ── 아래는 hardening(6) 신규 추가 ─────────────────────────────
  -- 7) 북마크 (hard delete — 개인 저장 목록)
  BEGIN
    DELETE FROM marie_wedding.bookmarks WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 8) 저장한 검색조건 (hard delete)
  BEGIN
    DELETE FROM marie_wedding.saved_searches WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 9) 가용 시간 슬롯 (hard delete — 개인 캘린더)
  BEGIN
    DELETE FROM marie_wedding.availability_slots WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 10) 사업자 인증 요청 (hard delete — 재가입 시 다시 신청)
  BEGIN
    DELETE FROM marie_wedding.verifications WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 11) 본인이 접수한 신고 (hard delete)
  BEGIN
    DELETE FROM marie_wedding.reports WHERE reporter_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 12) 게시글 좋아요 (hard delete — 익명 집계로도 남지 않도록)
  BEGIN
    DELETE FROM marie_wedding.post_likes WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 13) 휴대폰 OTP 요청 기록 (hard delete — 재가입 시 다시 인증)
  BEGIN
    DELETE FROM marie_wedding.phone_otps WHERE profile_id = p_profile_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;

-- ===================================================================
-- 프로필 컬럼 초기화 함수 — 재로그인 시 완전한 새 시작
-- ===================================================================
-- 사용처: auth/callback + auth/naver/callback 이 soft-deleted 프로필을
--         재활성화할 때 이 RPC 호출 → 이전 bio/phone/gallery 등 완전 제거.
-- ===================================================================

CREATE OR REPLACE FUNCTION marie_wedding.reactivate_profile_clean(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'marie_wedding', 'public'
AS $function$
BEGIN
  PERFORM set_config('marie_wedding.system_context', 'on', true);

  UPDATE marie_wedding.profiles
     SET
       -- 재활성화 플래그
       deleted_at = NULL,
       onboarded_at = NULL,
       -- account/business identity (온보딩에서 다시 입력)
       account_type = NULL,
       business_type = NULL,
       company_name = NULL,
       region = NULL,
       -- 개인정보 (완전 초기화)
       bio = NULL,
       phone = NULL,
       phone_verified = false,
       phone_verified_at = NULL,
       website = NULL,
       profile_image = NULL,
       company_size = NULL,
       established_year = NULL,
       address = NULL,
       gallery = NULL,
       -- 디렉토리 노출은 온보딩 후 재선택
       is_directory_listed = false,
       -- 사업자 인증 상태 초기화
       verification_status = 'unverified',
       verification_document = NULL,
       verification_submitted_at = NULL,
       verification_reviewed_at = NULL,
       verification_reject_reason = NULL,
       business_number = NULL,
       verified_at = NULL,
       -- 통계·성과 지표 초기화
       response_rate = 0,
       avg_response_minutes = NULL,
       completed_deals_count = 0,
       -- 유료 티어 초기화
       premium_tier = 'free',
       premium_until = NULL,
       -- 제재 이력 초기화 (새 계정으로 대우)
       banned_at = NULL,
       banned_reason = NULL,
       banned_by = NULL,
       -- 관리자 메모도 초기화 (완전 리셋 정책)
       admin_note = NULL,
       updated_at = NOW()
   WHERE id = p_profile_id;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;

COMMENT ON FUNCTION marie_wedding.purge_profile_cascade(uuid) IS
  '프로필 + 관련 콘텐츠 전체 삭제. 소유 콘텐츠(jobs/posts/comments/applications/reviews/portfolios)는 soft, 개인 목록(bookmarks/saved_searches/availability_slots/verifications/reports/notifications)은 hard delete.';

COMMENT ON FUNCTION marie_wedding.reactivate_profile_clean(uuid) IS
  'soft-deleted 프로필 재로그인 시 완전 초기화. deleted_at + 모든 사용자 컬럼(bio/phone/gallery/verification_*/banned_*/admin_note 등) NULL/default 리셋.';
