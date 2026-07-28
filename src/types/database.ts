import type { AccountType, BusinessType, EmploymentType, Region, PostCategory, PostingType } from '@/shared/constants';
import type { ResumeRecord, SubmittedResumeSnapshot } from '@/features/resumes/types';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ReviewTagCategory = 'positive' | 'attention';
export type ReviewDirection = 'hiring_to_applicant' | 'applicant_to_hiring';
export type JobStatus = 'open' | 'urgent' | 'closed' | 'filled' | 'hidden';

export type SignupProvider = 'email' | 'kakao' | 'google' | 'naver';

export interface Profile {
  id: string;
  /** 관리자가 대신 등록한 디렉토리 등재는 아직 주인이 없어 null 이다. */
  user_id: string | null;
  account_type: AccountType | null;
  business_type: BusinessType | null;
  company_name: string | null;
  contact_name: string;
  region: Region | null;
  signup_provider: SignupProvider | null;
  onboarded_at: string | null;
  naver_sub: string | null;
  bio: string | null;
  phone: string | null;
  website: string | null;
  profile_image: string | null;
  cover_image: string | null;
  is_directory_listed: boolean;
  company_size: string | null;
  established_year: string | null;
  address: string | null;
  gallery: string[] | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // 신뢰 레이어 (Phase 1+)
  verification_status: VerificationStatus;
  verification_document: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_reject_reason: string | null;
  business_number: string | null;
  verified_at: string | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
  response_rate: number;
  avg_response_minutes: number | null;
  completed_deals_count: number;
  premium_tier: 'free' | 'basic' | 'pro';
  featured_at?: string | null;
  featured_order?: number | null;
  premium_until: string | null;
  banned_at: string | null;
  banned_reason: string | null;
  banned_by: string | null;
  admin_note: string | null;
}

export type ModerationScope = 'job' | 'post' | 'all';
export type ModerationAction = 'hide';

export interface ModerationKeyword {
  id: string;
  keyword: string;
  scope: ModerationScope;
  action: ModerationAction;
  created_by: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  author_id: string | null;
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
  /** 추가 사진(갤러리) storage 경로. 기존 공고는 null */
  images: string[] | null;
  /**
   * 대행 등록 공고 — 업체 동의를 받아 관리자가 대신 올린 공고.
   * 아직 주인이 없으므로 author_id 가 null 이고, 표시용 업체명은 여기 담긴다.
   * 업체가 가입 후 claim_code 를 입력하면 author_id 가 채워지고 claimed_at 이 찍힌다.
   */
  proxy_company_name: string | null;
  proxy_contact: string | null;
  proxy_consent_note: string | null;
  proxy_consent_at: string | null;
  claim_code: string | null;
  claimed_at: string | null;
  view_count: number;
  hidden_by_admin: boolean;
  is_promoted: boolean;
  promoted_until: string | null;
  featured_at: string | null;
  featured_order: number | null;
  status: JobStatus;
  salary_min: number | null;
  salary_max: number | null;
  salary_unit: 'monthly' | 'yearly' | 'daily' | 'hourly';
  experience_min: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  author?: Profile;
}

export type PaymentProductType = 'job_promotion' | 'premium_tier' | 'event_listing' | 'directory_boost';
export type PaymentStatus = 'pending' | 'completed' | 'refunded' | 'failed' | 'cancelled';

export interface Payment {
  id: string;
  profile_id: string | null;
  amount: number;
  currency: string;
  product_type: PaymentProductType;
  product_id: string | null;
  status: PaymentStatus;
  gateway: string | null;
  gateway_transaction_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
  refunded_at: string | null;
}

export type SavedSearchScope = 'jobs' | 'directory';

export interface SavedSearch {
  id: string;
  profile_id: string;
  name: string;
  scope: SavedSearchScope;
  query: Record<string, unknown>;
  last_checked_at: string | null;
  created_at: string;
}

export type AvailabilityStatus = 'available' | 'busy';

export interface AvailabilitySlot {
  id: string;
  profile_id: string;
  date: string;
  status: AvailabilityStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string;
  created_at: string;
  partner?: Pick<Profile, 'id' | 'company_name' | 'contact_name' | 'profile_image'>;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  category: PostCategory;
  region: string | null;
  view_count: number;
  like_count: number;
  is_notice?: boolean;
  adopted_comment_id: string | null;
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
  resume_id: string | null;
  message: string;
  contact_phone: string | null;
  status: ApplicationStatus;
  author_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // 신뢰 레이어 Phase 2
  hiring_completed_at: string | null;
  applicant_completed_at: string | null;
  first_responded_at: string | null;
  job?: Job;
  applicant?: Profile;
}

export type Resume = ResumeRecord;

export interface ApplicationResumeSnapshot {
  application_id: string;
  source_resume_id: string | null;
  source_version: number;
  schema_version: number;
  photo_path: string | null;
  snapshot: SubmittedResumeSnapshot;
  created_at: string;
}

export interface ReviewTag {
  id: string;
  label: string;
  category: ReviewTagCategory;
  applies_to: Array<'hiring' | 'applicant'>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  profile_id: string;
  title: string;
  event_date: string | null;
  role: string | null;
  venue_name: string | null;
  description: string | null;
  images: string[];
  cover_image: string | null;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Review {
  id: string;
  application_id: string;
  reviewer_id: string;
  reviewee_id: string;
  direction: ReviewDirection;
  tags: string[];
  is_public: boolean;
  is_hidden_by_admin: boolean;
  created_at: string;
  deleted_at: string | null;
  reviewer?: Profile;
  resolved_tags?: ReviewTag[];
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

export type ReportTargetType = 'job' | 'profile' | 'post' | 'comment' | 'event' | 'review';

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

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_columns: string[] | null;
  changed_at: string;
}
