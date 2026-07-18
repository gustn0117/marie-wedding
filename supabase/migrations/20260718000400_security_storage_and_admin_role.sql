-- 보안 감사(외부) 재검증 확정 2건. 공유 storage.objects 이지만 마리에 버킷·함수만 정밀 수정.
--
-- C1: 마리에 스토리지 버킷의 과도한 anon 권한.
--   - verifications(private, 사업자등록증 PII 117개): public 역할이 SELECT/INSERT/UPDATE/
--     DELETE 전부 허용 → anon 키만으로 열람·덮어쓰기·삭제 가능. 사업자인증 기능은 제거됐고
--     앱이 이 버킷을 더는 안 쓰므로 4개 정책 전부 제거 → service_role 전용으로 잠금.
--   - avatars(public 이미지): 클라이언트가 인증 세션으로 {user_id}/... 경로에 직접 업로드.
--     기존 정책은 anon 쓰기 + 소유자 검사 없음(타인 파일 덮어쓰기/삭제 가능). authenticated +
--     소유자 경로로 좁힘. 공개 읽기는 유지(프로필 이미지는 공개).
--   - job-images(public): 클라 직접 covers/... 업로드(소유자 경로 아님) → 최소한 authenticated
--     요구로 anon 제거. 관리자 업로드는 service_role(RLS 우회)이라 무관.
--   - event-images(public): 업로드가 전부 service_role 서버 라우트 → anon 쓰기 정책 불필요, 제거.
--   앱 업로드는 전부 service_role 서버 라우트이거나 인증 세션 클라 업로드라 정상 동작 유지.

-- verifications: 완전 잠금(service_role 전용)
DROP POLICY IF EXISTS "Allow read verifications"      ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to verifications" ON storage.objects;
DROP POLICY IF EXISTS "Allow update verifications"    ON storage.objects;
DROP POLICY IF EXISTS "Allow delete verifications"    ON storage.objects;

-- avatars: 공개읽기 유지, 쓰기는 authenticated + 소유자 경로({user_id}/...)
DROP POLICY IF EXISTS avatars_insert ON storage.objects;
CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS avatars_update ON storage.objects;
CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS avatars_delete ON storage.objects;
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- job-images: 공개읽기 유지, 쓰기는 authenticated 로 제한(경로가 소유자 스코프 아님)
DROP POLICY IF EXISTS job_images_insert ON storage.objects;
CREATE POLICY job_images_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-images');
DROP POLICY IF EXISTS job_images_update ON storage.objects;
CREATE POLICY job_images_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'job-images') WITH CHECK (bucket_id = 'job-images');
DROP POLICY IF EXISTS job_images_delete ON storage.objects;
CREATE POLICY job_images_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-images');

-- event-images: 서버 라우트(service_role) 업로드만 → anon 쓰기 정책 제거(공개읽기 유지)
DROP POLICY IF EXISTS event_images_insert ON storage.objects;
DROP POLICY IF EXISTS event_images_update ON storage.objects;
DROP POLICY IF EXISTS event_images_delete ON storage.objects;

-- C2: role 기반 관리자 권한 상승.
--   - is_admin() 이 banned_at 을 안 봐서, 제재된 admin 이 자기 세션으로 self-unban 가능.
--   - reactivate_profile_clean 이 role 을 안 지워서, 탈퇴한 admin 이 재로그인하면 admin 복구.
--   현재 role='admin' 프로필은 0명이라 잠복 상태지만 role 관리자 경로 활성화 즉시 발현.
CREATE OR REPLACE FUNCTION marie_wedding.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM marie_wedding.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND deleted_at IS NULL
      AND banned_at IS NULL
  );
$$;

-- 재활성화 시 role 을 일반 사용자로 리셋(admin 특권이 탈퇴→재로그인으로 복구되지 않도록).
CREATE OR REPLACE FUNCTION marie_wedding.reactivate_profile_clean(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'marie_wedding', 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only';
  END IF;

  PERFORM set_config('marie_wedding.system_context', 'on', true);

  UPDATE marie_wedding.profiles
     SET deleted_at = NULL,
         onboarded_at = NULL,
         contact_name = '',
         account_type = NULL,
         business_type = NULL,
         company_name = NULL,
         region = NULL,
         bio = NULL,
         phone = NULL,
         phone_verified = false,
         phone_verified_at = NULL,
         website = NULL,
         profile_image = NULL,
         cover_image = NULL,
         company_size = NULL,
         established_year = NULL,
         address = NULL,
         gallery = NULL,
         is_directory_listed = false,
         verification_status = 'unverified',
         verification_document = NULL,
         verification_submitted_at = NULL,
         verification_reviewed_at = NULL,
         verification_reject_reason = NULL,
         business_number = NULL,
         verified_at = NULL,
         response_rate = 0,
         avg_response_minutes = NULL,
         completed_deals_count = 0,
         premium_tier = 'free',
         premium_until = NULL,
         banned_at = NULL,
         banned_reason = NULL,
         banned_by = NULL,
         admin_note = NULL,
         -- 재가입은 항상 일반 사용자 권한에서 시작한다.
         role = 'user',
         updated_at = NOW()
   WHERE id = p_profile_id;

  UPDATE marie_wedding.resumes
     SET deleted_at = NOW()
   WHERE profile_id = p_profile_id
     AND deleted_at IS NULL;

  PERFORM set_config('marie_wedding.system_context', 'off', true);
END;
$function$;
