-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE business_type AS ENUM ('venue', 'dress', 'studio', 'makeup', 'planner', 'assistant', 'other');
CREATE TYPE employment_type AS ENUM ('full_time', 'contract', 'part_time');
CREATE TYPE posting_type AS ENUM ('hiring', 'matching');
CREATE TYPE post_category AS ENUM ('news', 'tips', 'free');
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles table
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_type business_type NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  region TEXT NOT NULL,
  bio TEXT,
  phone TEXT,
  website TEXT,
  role user_role DEFAULT 'user' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Jobs table
CREATE TABLE jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  posting_type posting_type DEFAULT 'hiring' NOT NULL,
  business_type business_type NOT NULL,
  employment_type employment_type NOT NULL,
  region TEXT NOT NULL,
  salary_info TEXT,
  is_urgent BOOLEAN DEFAULT FALSE NOT NULL,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Posts table
CREATE TABLE posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category post_category NOT NULL,
  view_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comments table
CREATE TABLE comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_profiles_business_type ON profiles(business_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_region ON profiles(region) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_posting_type ON jobs(posting_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_business_type ON jobs(business_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_employment_type ON jobs(employment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_region ON jobs(region) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_category ON posts(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_created_at ON posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_post_id ON comments(post_id) WHERE deleted_at IS NULL;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Jobs policies
CREATE POLICY "Jobs are viewable by everyone" ON jobs
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can create jobs" ON jobs
  FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authors can update own jobs" ON jobs
  FOR UPDATE USING (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON posts
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can create posts" ON posts
  FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authors can update own posts" ON posts
  FOR UPDATE USING (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can create comments" ON comments
  FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authors can update own comments" ON comments
  FOR UPDATE USING (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
