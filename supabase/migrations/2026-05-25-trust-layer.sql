-- 신뢰 레이어 통합 마이그레이션 (Phase 1~4)
-- 작성일: 2026-05-25
-- 적용: 자체 호스팅 Supabase 콘솔 또는 psql로 실행

-- 1) ENUM 추가
DO $$ BEGIN
  CREATE TYPE marie_wedding.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marie_wedding.review_tag_category AS ENUM ('positive', 'attention');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marie_wedding.review_direction AS ENUM ('hiring_to_applicant', 'applicant_to_hiring');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) profiles 컬럼 추가
ALTER TABLE marie_wedding.profiles
  ADD COLUMN IF NOT EXISTS verification_status marie_wedding.verification_status DEFAULT 'unverified' NOT NULL,
  ADD COLUMN IF NOT EXISTS verification_document TEXT,
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS business_number TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_rate NUMERIC(5,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS avg_response_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS completed_deals_count INTEGER DEFAULT 0 NOT NULL;

-- 3) applications 컬럼 추가
ALTER TABLE marie_wedding.applications
  ADD COLUMN IF NOT EXISTS hiring_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applicant_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMPTZ;

-- 4) portfolios 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  event_date DATE,
  role TEXT,
  venue_name TEXT,
  description TEXT,
  images TEXT[] DEFAULT '{}' NOT NULL,
  cover_image TEXT,
  is_featured BOOLEAN DEFAULT FALSE NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portfolios_profile_order
  ON marie_wedding.portfolios(profile_id, display_order)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS portfolios_updated_at ON marie_wedding.portfolios;
CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON marie_wedding.portfolios
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

-- 5) review_tags 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.review_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  category marie_wedding.review_tag_category NOT NULL,
  applies_to TEXT[] NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS review_tags_updated_at ON marie_wedding.review_tags;
CREATE TRIGGER review_tags_updated_at
  BEFORE UPDATE ON marie_wedding.review_tags
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

-- 6) reviews 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES marie_wedding.applications(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  direction marie_wedding.review_direction NOT NULL,
  tags UUID[] NOT NULL,
  is_public BOOLEAN DEFAULT TRUE NOT NULL,
  is_hidden_by_admin BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_application_direction
  ON marie_wedding.reviews(application_id, direction)
  WHERE deleted_at IS NULL;

-- 7) RLS for new tables
ALTER TABLE marie_wedding.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.review_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolios_select ON marie_wedding.portfolios;
CREATE POLICY portfolios_select ON marie_wedding.portfolios
  FOR SELECT USING (deleted_at IS NULL OR marie_wedding.is_admin());

DROP POLICY IF EXISTS portfolios_insert ON marie_wedding.portfolios;
CREATE POLICY portfolios_insert ON marie_wedding.portfolios
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS portfolios_update ON marie_wedding.portfolios;
CREATE POLICY portfolios_update ON marie_wedding.portfolios
  FOR UPDATE USING (
    profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    OR marie_wedding.is_admin()
  );

DROP POLICY IF EXISTS review_tags_select ON marie_wedding.review_tags;
CREATE POLICY review_tags_select ON marie_wedding.review_tags
  FOR SELECT USING (is_active = TRUE OR marie_wedding.is_admin());

DROP POLICY IF EXISTS review_tags_admin_all ON marie_wedding.review_tags;
CREATE POLICY review_tags_admin_all ON marie_wedding.review_tags
  FOR ALL USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

DROP POLICY IF EXISTS reviews_select ON marie_wedding.reviews;
CREATE POLICY reviews_select ON marie_wedding.reviews
  FOR SELECT USING (
    (is_public = TRUE AND is_hidden_by_admin = FALSE AND deleted_at IS NULL)
    OR marie_wedding.is_admin()
    OR reviewer_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    OR reviewee_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS reviews_admin_update ON marie_wedding.reviews;
CREATE POLICY reviews_admin_update ON marie_wedding.reviews
  FOR UPDATE USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

-- 8) 트리거: applications status 첫 변경 시 first_responded_at 기록
CREATE OR REPLACE FUNCTION marie_wedding.set_first_responded()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status <> 'pending' AND NEW.first_responded_at IS NULL THEN
    NEW.first_responded_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS applications_first_responded ON marie_wedding.applications;
CREATE TRIGGER applications_first_responded
  BEFORE UPDATE OF status ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.set_first_responded();

-- 9) 트리거: 양쪽 거래 완료 시 completed_deals_count +1 + 알림
CREATE OR REPLACE FUNCTION marie_wedding.notify_deal_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_job marie_wedding.jobs%ROWTYPE;
  v_was_completed BOOLEAN;
  v_is_completed BOOLEAN;
BEGIN
  v_was_completed := OLD.hiring_completed_at IS NOT NULL AND OLD.applicant_completed_at IS NOT NULL;
  v_is_completed := NEW.hiring_completed_at IS NOT NULL AND NEW.applicant_completed_at IS NOT NULL;

  IF NOT v_was_completed AND v_is_completed THEN
    SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = NEW.job_id;

    UPDATE marie_wedding.profiles SET completed_deals_count = completed_deals_count + 1
      WHERE id IN (v_job.author_id, NEW.applicant_id);

    INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
    VALUES
      (v_job.author_id, 'deal_completed', '거래가 완료되었습니다',
       '"' || v_job.title || '" 거래가 양쪽 완료 처리되어 리뷰를 작성할 수 있습니다.',
       '/applications/' || NEW.id || '/review'),
      (NEW.applicant_id, 'deal_completed', '거래가 완료되었습니다',
       '"' || v_job.title || '" 거래가 양쪽 완료 처리되어 리뷰를 작성할 수 있습니다.',
       '/applications/' || NEW.id || '/review');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS applications_deal_completed ON marie_wedding.applications;
CREATE TRIGGER applications_deal_completed
  AFTER UPDATE OF hiring_completed_at, applicant_completed_at ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_deal_completed();

-- 10) 인증 상태 변경 시 verified_at 자동 + 알림
CREATE OR REPLACE FUNCTION marie_wedding.set_verification_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.verification_status <> NEW.verification_status THEN
    IF NEW.verification_status = 'verified' AND NEW.verified_at IS NULL THEN
      NEW.verified_at = NOW();
    END IF;
    IF NEW.verification_status IN ('verified', 'rejected') THEN
      NEW.verification_reviewed_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_verification_status_set_at ON marie_wedding.profiles;
CREATE TRIGGER profiles_verification_status_set_at
  BEFORE UPDATE OF verification_status ON marie_wedding.profiles
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.set_verification_timestamps();

CREATE OR REPLACE FUNCTION marie_wedding.notify_verification_result()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_msg TEXT;
BEGIN
  IF OLD.verification_status = NEW.verification_status THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status = 'verified' THEN
    v_title := '업체 인증이 승인되었습니다';
    v_msg := '프로필에 인증 배지가 노출됩니다.';
  ELSIF NEW.verification_status = 'rejected' THEN
    v_title := '업체 인증 신청이 거절되었습니다';
    v_msg := COALESCE('사유: ' || NEW.verification_reject_reason, '관리자에게 문의해 주세요.');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
  VALUES (NEW.id, 'verification_result', v_title, v_msg, '/mypage/verification');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS profiles_verification_notify ON marie_wedding.profiles;
CREATE TRIGGER profiles_verification_notify
  AFTER UPDATE OF verification_status ON marie_wedding.profiles
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_verification_result();

NOTIFY pgrst, 'reload schema';
