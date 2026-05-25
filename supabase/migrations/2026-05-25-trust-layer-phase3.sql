-- 신뢰 레이어 Phase 3: 포트폴리오 Storage RLS 정책
-- 작성일: 2026-05-25
-- 사전 작업: Supabase 콘솔에서 portfolios 버킷을 public=true로 생성

-- Storage policies for portfolios bucket
-- 경로 패턴: portfolios/{profile_id}/{...}
DO $$
BEGIN
  -- Drop existing policies if they exist
  EXECUTE 'DROP POLICY IF EXISTS portfolios_storage_read ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS portfolios_storage_insert ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS portfolios_storage_delete ON storage.objects';

  -- public read
  EXECUTE $POL$
    CREATE POLICY portfolios_storage_read ON storage.objects
      FOR SELECT USING (bucket_id = 'portfolios')
  $POL$;

  -- insert: only own folder
  EXECUTE $POL$
    CREATE POLICY portfolios_storage_insert ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'portfolios'
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM marie_wedding.profiles
          WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
      )
  $POL$;

  EXECUTE $POL$
    CREATE POLICY portfolios_storage_delete ON storage.objects
      FOR DELETE USING (
        bucket_id = 'portfolios'
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM marie_wedding.profiles
          WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
      )
  $POL$;
EXCEPTION WHEN OTHERS THEN
  -- self-hosted env may not expose storage.objects; admin can apply manually
  RAISE NOTICE 'storage policies skipped: %', SQLERRM;
END $$;
