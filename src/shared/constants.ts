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
  { value: 'news', label: '업계뉴스' },
  { value: 'tips', label: '노하우공유' },
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
  DIRECTORY: '/directory',
  DIRECTORY_DETAIL: (id: string) => `/directory/${id}`,
  EVENTS: '/events',
  EVENTS_DETAIL: (id: string) => `/events/${id}`,
  COMMUNITY: '/community',
  COMMUNITY_NEW: '/community/new',
  COMMUNITY_DETAIL: (id: string) => `/community/${id}`,
} as const;
