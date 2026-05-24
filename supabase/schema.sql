-- Marié full schema for the self-hosted Supabase project.
-- App schema: marie_wedding

CREATE SCHEMA IF NOT EXISTS marie_wedding;

GRANT USAGE ON SCHEMA marie_wedding TO authenticator, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marie_wedding TO authenticator, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marie_wedding GRANT ALL ON TABLES TO authenticator, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marie_wedding GRANT ALL ON SEQUENCES TO authenticator, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE marie_wedding.account_type AS ENUM ('individual', 'business');
CREATE TYPE marie_wedding.employment_type AS ENUM ('full_time', 'contract', 'part_time');
CREATE TYPE marie_wedding.posting_type AS ENUM ('hiring', 'matching');
CREATE TYPE marie_wedding.post_category AS ENUM ('news', 'tips', 'free');
CREATE TYPE marie_wedding.user_role AS ENUM ('user', 'admin');

CREATE OR REPLACE FUNCTION marie_wedding.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE marie_wedding.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  account_type marie_wedding.account_type DEFAULT 'business' NOT NULL,
  business_type TEXT,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  region TEXT NOT NULL,
  bio TEXT,
  phone TEXT,
  website TEXT,
  role marie_wedding.user_role DEFAULT 'user' NOT NULL,
  profile_image TEXT,
  is_directory_listed BOOLEAN DEFAULT FALSE NOT NULL,
  company_size TEXT,
  established_year TEXT,
  address TEXT,
  gallery TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON marie_wedding.profiles
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

CREATE TABLE marie_wedding.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  posting_type marie_wedding.posting_type DEFAULT 'hiring' NOT NULL,
  business_type TEXT NOT NULL,
  employment_type marie_wedding.employment_type NOT NULL,
  region TEXT NOT NULL,
  salary_info TEXT,
  is_urgent BOOLEAN DEFAULT FALSE NOT NULL,
  deadline TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON marie_wedding.jobs
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

CREATE TABLE marie_wedding.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category marie_wedding.post_category NOT NULL,
  view_count INTEGER DEFAULT 0 NOT NULL,
  like_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON marie_wedding.posts
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

CREATE TABLE marie_wedding.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES marie_wedding.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON marie_wedding.comments
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

CREATE TABLE marie_wedding.post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES marie_wedding.posts(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(post_id, profile_id)
);

CREATE TABLE marie_wedding.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'event' NOT NULL CHECK (type IN ('event', 'news', 'notice')),
  image TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  location TEXT,
  link_url TEXT,
  is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
  view_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON marie_wedding.events
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

CREATE TABLE marie_wedding.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES marie_wedding.jobs(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT DEFAULT '' NOT NULL,
  contact_phone TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewing', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_applications_job_applicant_active
  ON marie_wedding.applications(job_id, applicant_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

CREATE TABLE marie_wedding.bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('job', 'profile', 'post', 'event')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(profile_id, target_type, target_id)
);

CREATE TABLE marie_wedding.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'system' NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE marie_wedding.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('job', 'profile', 'post', 'comment', 'event')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON marie_wedding.reports
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

CREATE INDEX idx_profiles_business_type ON marie_wedding.profiles(business_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_region ON marie_wedding.profiles(region) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_posting_type ON marie_wedding.jobs(posting_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_business_type ON marie_wedding.jobs(business_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_employment_type ON marie_wedding.jobs(employment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_region ON marie_wedding.jobs(region) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_created_at ON marie_wedding.jobs(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_category ON marie_wedding.posts(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_created_at ON marie_wedding.posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_post_id ON marie_wedding.comments(post_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_job_id ON marie_wedding.applications(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_applicant_id ON marie_wedding.applications(applicant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookmarks_profile_id ON marie_wedding.bookmarks(profile_id);
CREATE INDEX idx_notifications_profile_created ON marie_wedding.notifications(profile_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_reports_status_created ON marie_wedding.reports(status, created_at DESC);

CREATE OR REPLACE FUNCTION marie_wedding.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marie_wedding.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION marie_wedding.increment_view_count(post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
BEGIN
  UPDATE marie_wedding.posts
  SET view_count = view_count + 1
  WHERE id = post_id;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.toggle_post_like(p_post_id UUID, p_profile_id UUID)
RETURNS TABLE(liked BOOLEAN, like_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marie_wedding, public
AS $$
DECLARE
  v_existing UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM marie_wedding.profiles
    WHERE id = p_profile_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT id INTO v_existing
  FROM marie_wedding.post_likes
  WHERE post_id = p_post_id AND profile_id = p_profile_id
  LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO marie_wedding.post_likes(post_id, profile_id) VALUES (p_post_id, p_profile_id);
    liked := TRUE;
  ELSE
    DELETE FROM marie_wedding.post_likes WHERE id = v_existing;
    liked := FALSE;
  END IF;

  SELECT COUNT(*)::INTEGER INTO like_count FROM marie_wedding.post_likes WHERE post_id = p_post_id;
  UPDATE marie_wedding.posts SET like_count = toggle_post_like.like_count WHERE id = p_post_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION marie_wedding.notify_application_created()
RETURNS TRIGGER AS $$
DECLARE
  v_job marie_wedding.jobs%ROWTYPE;
  v_applicant_name TEXT;
BEGIN
  SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = NEW.job_id;
  IF NOT FOUND OR v_job.author_id = NEW.applicant_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(company_name, contact_name, '사용자')
  INTO v_applicant_name
  FROM marie_wedding.profiles
  WHERE id = NEW.applicant_id;

  INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
  VALUES (
    v_job.author_id,
    'application_created',
    '새 지원/문의가 접수되었습니다',
    COALESCE(v_applicant_name, '사용자') || '님이 "' || v_job.title || '" 공고에 지원/문의를 남겼습니다.',
    '/jobs/' || NEW.job_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

CREATE TRIGGER applications_notify_created
  AFTER INSERT ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_application_created();

CREATE OR REPLACE FUNCTION marie_wedding.notify_application_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_status_label TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_job_title FROM marie_wedding.jobs WHERE id = NEW.job_id;
  v_status_label := CASE NEW.status
    WHEN 'reviewing' THEN '검토 중'
    WHEN 'accepted' THEN '승인'
    WHEN 'rejected' THEN '거절'
    WHEN 'cancelled' THEN '취소'
    ELSE '접수'
  END;

  INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
  VALUES (
    NEW.applicant_id,
    'application_status',
    '지원/문의 상태가 변경되었습니다',
    '"' || COALESCE(v_job_title, '공고') || '" 상태가 ' || v_status_label || '(으)로 변경되었습니다.',
    '/jobs/' || NEW.job_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

CREATE TRIGGER applications_notify_status
  AFTER UPDATE OF status ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_application_status_changed();

ALTER TABLE marie_wedding.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON marie_wedding.profiles FOR SELECT USING (deleted_at IS NULL OR marie_wedding.is_admin());
CREATE POLICY profiles_insert ON marie_wedding.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update ON marie_wedding.profiles FOR UPDATE USING (auth.uid() = user_id OR marie_wedding.is_admin());

CREATE POLICY jobs_select ON marie_wedding.jobs FOR SELECT USING (deleted_at IS NULL OR marie_wedding.is_admin());
CREATE POLICY jobs_insert ON marie_wedding.jobs FOR INSERT WITH CHECK (author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid()));
CREATE POLICY jobs_update ON marie_wedding.jobs FOR UPDATE USING (author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid()) OR marie_wedding.is_admin());

CREATE POLICY posts_select ON marie_wedding.posts FOR SELECT USING (deleted_at IS NULL OR marie_wedding.is_admin());
CREATE POLICY posts_insert ON marie_wedding.posts FOR INSERT WITH CHECK (author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid()));
CREATE POLICY posts_update ON marie_wedding.posts FOR UPDATE USING (author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid()) OR marie_wedding.is_admin());

CREATE POLICY comments_select ON marie_wedding.comments FOR SELECT USING (deleted_at IS NULL OR marie_wedding.is_admin());
CREATE POLICY comments_insert ON marie_wedding.comments FOR INSERT WITH CHECK (author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid()));
CREATE POLICY comments_update ON marie_wedding.comments FOR UPDATE USING (author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid()) OR marie_wedding.is_admin());

CREATE POLICY post_likes_select ON marie_wedding.post_likes FOR SELECT USING (true);
CREATE POLICY post_likes_insert_own ON marie_wedding.post_likes FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY post_likes_delete_own ON marie_wedding.post_likes FOR DELETE USING (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));

CREATE POLICY events_select ON marie_wedding.events FOR SELECT USING (deleted_at IS NULL OR marie_wedding.is_admin());
CREATE POLICY events_admin_all ON marie_wedding.events FOR ALL USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

CREATE POLICY applications_select_related ON marie_wedding.applications FOR SELECT USING (
  marie_wedding.is_admin()
  OR applicant_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  OR job_id IN (SELECT id FROM marie_wedding.jobs WHERE author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL))
);
CREATE POLICY applications_insert_own ON marie_wedding.applications FOR INSERT WITH CHECK (
  applicant_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  AND job_id NOT IN (SELECT id FROM marie_wedding.jobs WHERE author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL))
);
CREATE POLICY applications_update_related ON marie_wedding.applications FOR UPDATE USING (
  marie_wedding.is_admin()
  OR applicant_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  OR job_id IN (SELECT id FROM marie_wedding.jobs WHERE author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL))
) WITH CHECK (
  marie_wedding.is_admin()
  OR applicant_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  OR job_id IN (SELECT id FROM marie_wedding.jobs WHERE author_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL))
);

CREATE POLICY bookmarks_select_own ON marie_wedding.bookmarks FOR SELECT USING (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY bookmarks_insert_own ON marie_wedding.bookmarks FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY bookmarks_delete_own ON marie_wedding.bookmarks FOR DELETE USING (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));

CREATE POLICY notifications_select_own ON marie_wedding.notifications FOR SELECT USING (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY notifications_update_own ON marie_wedding.notifications FOR UPDATE USING (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)) WITH CHECK (profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));

CREATE POLICY reports_insert_own ON marie_wedding.reports FOR INSERT WITH CHECK (reporter_id IS NULL OR reporter_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY reports_select_related ON marie_wedding.reports FOR SELECT USING (marie_wedding.is_admin() OR reporter_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY reports_admin_update ON marie_wedding.reports FOR UPDATE USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

DO $$
DECLARE
  current_schemas text;
  new_schema text := 'marie_wedding';
BEGIN
  SELECT coalesce(
    (SELECT split_part(c, '=', 2)
     FROM unnest(rolconfig) AS c
     WHERE c LIKE 'pgrst.db_schemas=%'),
    'public, storage, graphql_public'
  ) INTO current_schemas
  FROM pg_roles WHERE rolname = 'authenticator';

  IF current_schemas NOT LIKE '%' || new_schema || '%' THEN
    current_schemas := current_schemas || ', ' || new_schema;
  END IF;

  EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', current_schemas);
  NOTIFY pgrst, 'reload schema';
END $$;
