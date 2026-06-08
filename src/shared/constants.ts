import type { VerificationStatus, JobStatus } from '@/types/database';

export const ACCOUNT_TYPES = [
  { value: 'individual', label: '개인 회원' },
  { value: 'business', label: '업체 회원' },
] as const;

export type AccountType = typeof ACCOUNT_TYPES[number]['value'];

export const BUSINESS_TYPES = [
  { value: 'venue', label: '예식장' },
  { value: 'dress', label: '드레스샵' },
  { value: 'studio', label: '스튜디오' },
  { value: 'makeup', label: '메이크업' },
  { value: 'planner', label: '웨딩플래너' },
  { value: 'assistant', label: '예식 도우미' },
  { value: 'mc', label: '사회자' },
  { value: 'designer', label: '디자이너' },
  { value: 'singer', label: '축가' },
  { value: 'other', label: '기타' },
] as const;

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: '정규직' },
  { value: 'contract', label: '계약직' },
  { value: 'part_time', label: '단기알바' },
] as const;

export const POSTING_TYPES = [
  { value: 'hiring', label: '채용' },
  { value: 'matching', label: '업체 섭외' },
] as const;

export const REGIONS = [
  { value: 'seoul', label: '서울' },
  { value: 'gyeonggi', label: '경기' },
  { value: 'incheon', label: '인천' },
  { value: 'busan', label: '부산' },
  { value: 'daegu', label: '대구' },
  { value: 'daejeon', label: '대전' },
  { value: 'gwangju', label: '광주' },
  { value: 'ulsan', label: '울산' },
  { value: 'sejong', label: '세종' },
  { value: 'gangwon', label: '강원' },
  { value: 'chungbuk', label: '충북' },
  { value: 'chungnam', label: '충남' },
  { value: 'jeonbuk', label: '전북' },
  { value: 'jeonnam', label: '전남' },
  { value: 'gyeongbuk', label: '경북' },
  { value: 'gyeongnam', label: '경남' },
  { value: 'jeju', label: '제주' },
] as const;

export const POST_CATEGORIES = [
  { value: 'news', label: '정보공유' },
  { value: 'tips', label: '노하우공유' },
  { value: 'qna', label: '질문' },
  { value: 'review', label: '후기' },
  { value: 'local', label: '지역소식' },
  { value: 'jobtip', label: '구인팁' },
  { value: 'free', label: '자유게시판' },
] as const;

export type BusinessType = typeof BUSINESS_TYPES[number]['value'];
export type EmploymentType = typeof EMPLOYMENT_TYPES[number]['value'];
export type Region = typeof REGIONS[number]['value'];
export type PostCategory = typeof POST_CATEGORIES[number]['value'];
export type PostingType = typeof POSTING_TYPES[number]['value'];

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  JOBS: '/jobs',
  JOBS_NEW: '/jobs/new',
  JOBS_DETAIL: (id: string) => `/jobs/${id}`,
  JOBS_EDIT: (id: string) => `/jobs/${id}/edit`,
  DIRECTORY: '/directory',
  DIRECTORY_DETAIL: (id: string) => `/directory/${id}`,
  DIRECTORY_REGISTER: '/mypage/directory',
  EVENTS: '/events',
  EVENTS_DETAIL: (id: string) => `/events/${id}`,
  COMMUNITY: '/community',
  COMMUNITY_NEW: '/community/new',
  COMMUNITY_DETAIL: (id: string) => `/community/${id}`,
  COMMUNITY_EDIT: (id: string) => `/community/${id}/edit`,
  MYPAGE: '/mypage',
  MYPAGE_EDIT: '/mypage/edit',
  MYPAGE_PASSWORD: '/mypage/password',
  MYPAGE_NOTIFICATIONS: '/mypage/notifications',
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_JOBS: '/admin/jobs',
  ADMIN_POSTS: '/admin/posts',
  ADMIN_COMMENTS: '/admin/comments',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_EVENTS: '/admin/events',
  ADMIN_EVENTS_NEW: '/admin/events/new',
  ADMIN_EVENTS_EDIT: (id: string) => `/admin/events/${id}/edit`,
  ADMIN_VERIFICATIONS: '/admin/verifications',
  ADMIN_SETTLEMENTS: '/admin/settlements',
  ADMIN_AUDIT_LOG: '/admin/audit-log',
  ADMIN_MODERATION_KEYWORDS: '/admin/moderation-keywords',
  MYPAGE_VERIFICATION: '/mypage/verification',
  MYPAGE_PORTFOLIOS: '/mypage/portfolios',
  MYPAGE_PORTFOLIO_NEW: '/mypage/portfolios/new',
  MYPAGE_PORTFOLIO_EDIT: (id: string) => `/mypage/portfolios/${id}/edit`,
  MYPAGE_PHONE_VERIFICATION: '/mypage/phone-verification',
  MYPAGE_SAVED_SEARCHES: '/mypage/saved-searches',
  MYPAGE_AVAILABILITY: '/mypage/availability',
  MYPAGE_MESSAGES: '/mypage/messages',
  MYPAGE_MESSAGE_DETAIL: (id: string) => `/mypage/messages/${id}`,
  MYPAGE_BOOKMARKS: '/mypage/bookmarks',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  // B2B 거래 — 견적 (Milestone 1.2)
  QUOTATIONS: '/mypage/quotations',
  QUOTATIONS_NEW: '/quotations/new',
  QUOTATIONS_DETAIL: (id: string) => `/quotations/${id}`,
  QUOTATIONS_EDIT: (id: string) => `/quotations/${id}/edit`,
  // B2B 거래 — 계약 / 예약 / 정산 (Milestone 1.3-1.5)
  CONTRACTS: '/mypage/contracts',
  CONTRACTS_DETAIL: (id: string) => `/contracts/${id}`,
  BOOKINGS: '/mypage/bookings',
  SETTLEMENTS: '/mypage/settlements',
} as const;

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: '미인증',
  pending: '검토 중',
  verified: '인증 완료',
  rejected: '거절됨',
};

export const VERIFICATION_BADGE_LABEL = '인증';
export const PHONE_VERIFIED_BADGE_LABEL = '실명 확인';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: '모집중',
  urgent: '마감임박',
  closed: '마감',
  filled: '채용완료',
  hidden: '숨김',
};
