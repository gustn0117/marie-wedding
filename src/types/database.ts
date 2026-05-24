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

export type ApplicationStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'cancelled';

export interface Application {
  id: string;
  job_id: string;
  applicant_id: string;
  message: string;
  contact_phone: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  job?: Job;
  applicant?: Profile;
}

export type BookmarkTargetType = 'job' | 'profile' | 'post' | 'event';

export interface Bookmark {
  id: string;
  profile_id: string;
  target_type: BookmarkTargetType;
  target_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export type ReportTargetType = 'job' | 'profile' | 'post' | 'comment' | 'event';

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
}
