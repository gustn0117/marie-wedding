import type { AccountType, BusinessType, EmploymentType, Region, PostCategory, PostingType } from '@/shared/constants';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ReviewTagCategory = 'positive' | 'attention';
export type ReviewDirection = 'hiring_to_applicant' | 'applicant_to_hiring';
export type JobStatus = 'open' | 'urgent' | 'closed' | 'filled' | 'hidden';

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
  premium_until: string | null;
  banned_at: string | null;
  banned_reason: string | null;
  banned_by: string | null;
  admin_note: string | null;
}

export type ModerationScope = 'job' | 'post' | 'comment' | 'all';
export type ModerationAction = 'hide' | 'flag';

export interface ModerationKeyword {
  id: string;
  keyword: string;
  scope: ModerationScope;
  action: ModerationAction;
  created_by: string | null;
  created_at: string;
}

export type TrustTier = 'unverified' | 'phone_verified' | 'business_verified' | 'deal_proven';

export function computeTrustTier(profile: Pick<Profile, 'verification_status' | 'phone_verified' | 'completed_deals_count'>): TrustTier {
  if (profile.completed_deals_count >= 5) return 'deal_proven';
  if (profile.verification_status === 'verified') return 'business_verified';
  if (profile.phone_verified) return 'phone_verified';
  return 'unverified';
}

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  unverified: '미인증',
  phone_verified: '실명 확인',
  business_verified: '인증 업체',
  deal_proven: '거래 검증',
};

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
  view_count: number;
  hidden_by_admin: boolean;
  is_promoted: boolean;
  promoted_until: string | null;
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
  author_id: string;
  title: string;
  content: string;
  category: PostCategory;
  region: string | null;
  view_count: number;
  like_count: number;
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

// ─────────────────────────────────────────────────────────
// B2B 거래 모델 (2026-06-08 신규)
// ─────────────────────────────────────────────────────────

export type OrganizationMemberRole = 'owner' | 'manager' | 'staff';

export interface Organization {
  id: string;
  owner_profile_id: string;
  name: string;
  business_number: string | null;
  representative_name: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  member_profile_id: string;
  role: OrganizationMemberRole;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
  deleted_at: string | null;
  // joined
  member?: Profile;
}

export type QuotationStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface Quotation {
  id: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  conversation_id: string | null;
  title: string;
  description: string | null;
  event_date: string | null;
  event_venue: string | null;
  subtotal: number;
  tax: number;
  total_amount: number;
  currency: string;
  status: QuotationStatus;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  valid_until: string | null;
  internal_note: string | null;
  rejection_reason: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  items?: QuotationItem[];
  sender?: Profile;
  receiver?: Profile;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  note: string | null;
  created_at: string;
}

export type ContractStatus = 'draft' | 'awaiting_signatures' | 'signed' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export interface Contract {
  id: string;
  quotation_id: string;
  party_a_profile_id: string;
  party_b_profile_id: string;
  party_a_org_name: string;
  party_b_org_name: string;
  title: string;
  description: string | null;
  event_date: string;
  event_venue: string | null;
  total_amount: number;
  currency: string;
  payment_terms: string | null;
  cancellation_terms: string | null;
  status: ContractStatus;
  signed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  signatures?: ContractSignature[];
  party_a?: Profile;
  party_b?: Profile;
  quotation?: Quotation;
}

export type SignerSide = 'party_a' | 'party_b';

export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_profile_id: string;
  signer_side: SignerSide;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type BookingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  id: string;
  contract_id: string;
  provider_profile_id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  status: BookingStatus;
  completed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SettlementStatus = 'pending' | 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled';

export interface Settlement {
  id: string;
  contract_id: string;
  payee_profile_id: string;
  gross_amount: number;
  platform_fee_rate: number;
  platform_fee_amount: number;
  tax_withheld: number;
  net_amount: number;
  status: SettlementStatus;
  payout_method: string | null;
  payout_account: string | null;
  payout_reference: string | null;
  scheduled_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined (settlement-service의 SETTLEMENT_WITH_RELATIONS 쿼리에서 채워짐)
  contract?: Pick<Contract, 'id' | 'title' | 'event_date' | 'party_a_org_name' | 'party_b_org_name' | 'party_a_profile_id' | 'party_b_profile_id'>;
  payee?: Profile;
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

// 상태 라벨 (한국어)
export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: '작성 중',
  sent: '발송됨',
  viewed: '열람됨',
  accepted: '승인됨',
  rejected: '거절됨',
  expired: '만료',
  cancelled: '취소됨',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: '작성 중',
  awaiting_signatures: '서명 대기',
  signed: '서명 완료',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소',
  disputed: '분쟁 중',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  scheduled: '예약됨',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼',
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  pending: '대기',
  approved: '승인',
  processing: '처리 중',
  paid: '지급 완료',
  failed: '실패',
  cancelled: '취소',
};

export const ORGANIZATION_MEMBER_ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  owner: '오너',
  manager: '매니저',
  staff: '스태프',
};
