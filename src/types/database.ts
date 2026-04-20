import type { AccountType, BusinessType, EmploymentType, Region, PostCategory, PostingType } from '@/shared/constants';

export interface Profile {
  id: string;
  user_id: string;
  account_type: AccountType;
  business_type: BusinessType | null;
  company_name: string | null;
  contact_name: string;
  region: Region;
  bio: string | null;
  phone: string | null;
  website: string | null;
  profile_image: string | null;
  is_directory_listed: boolean;
  company_size: string | null;
  established_year: string | null;
  address: string | null;
  gallery: string[] | null;
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
  image: string | null;
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
  like_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  author?: Profile;
  comment_count?: number;
  is_liked?: boolean;
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

export type EventType = 'event' | 'news' | 'notice';

export interface Event {
  id: string;
  title: string;
  content: string;
  type: EventType;
  image: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  link_url: string | null;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
