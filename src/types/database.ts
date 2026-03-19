import type { BusinessType, EmploymentType, Region, PostCategory, PostingType } from '@/shared/constants';

export interface Profile {
  id: string;
  user_id: string;
  business_type: BusinessType;
  company_name: string;
  contact_name: string;
  region: Region;
  bio: string | null;
  phone: string | null;
  website: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Job {
  id: string;
  author_id: string;
  posting_type: PostingType;
  title: string;
  description: string;
  business_type: BusinessType;
  employment_type: EmploymentType;
  region: Region;
  salary_info: string | null;
  is_urgent: boolean;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  author?: Profile;
}

export interface Post {
  id: string;
  author_id: string;
  title: string;
  content: string;
  category: PostCategory;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  author?: Profile;
  comment_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  author?: Profile;
}
