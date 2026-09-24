import { BUSINESS_TYPES, POST_CATEGORIES, ROUTES } from '@/shared/constants';

/**
 * 사이트 전체 메뉴 — 헤더 가운데 nav 와 전체메뉴 드로어가 같은 구조를 쓴다.
 * 섹션 하나 = 헤더 nav 항목 하나 = 드로어 좌측 목록 한 줄, links = 드로어 우측 하위 메뉴.
 */
export interface SiteMenuLink {
  label: string;
  href: string;
  external?: boolean;
  /** 있으면 펼침형 항목 — 드로어에서 눌러야 하위 목록이 열린다 */
  children?: { label: string; href: string }[];
}

export interface SiteMenuSection {
  id: string;
  label: string;
  /** 헤더 nav 에서만 다르게 보일 이름 (없으면 label) */
  navLabel?: string;
  href: string;
  external?: boolean;
  links: SiteMenuLink[];
}

export const PARTNER_URL = 'https://haramevent.kr';

// '기타'는 탐색 필터로 의미가 없어 업종별 바로가기에서 뺀다.
const BROWSABLE_TYPES = BUSINESS_TYPES.filter((t) => t.value !== 'other');

export const SITE_MENU: SiteMenuSection[] = [
  {
    id: 'jobs',
    label: '채용정보',
    href: ROUTES.JOBS,
    links: [
      { label: '전체 공고', href: ROUTES.JOBS },
      {
        label: '업종별 공고',
        href: ROUTES.JOBS,
        children: BROWSABLE_TYPES.map((t) => ({ label: t.label, href: `${ROUTES.JOBS}?businessType=${t.value}` })),
      },
      { label: '공고 등록', href: ROUTES.JOBS_NEW },
    ],
  },
  {
    id: 'directory',
    label: '인재·업체 프로필',
    href: ROUTES.DIRECTORY,
    links: [
      { label: '전체 프로필', href: ROUTES.DIRECTORY },
      {
        label: '업종별 프로필',
        href: ROUTES.DIRECTORY,
        children: BROWSABLE_TYPES.map((t) => ({ label: t.label, href: `${ROUTES.DIRECTORY}?businessType=${t.value}` })),
      },
      { label: '프로필 등록', href: ROUTES.DIRECTORY_REGISTER },
    ],
  },
  {
    id: 'community',
    label: '커뮤니티',
    href: ROUTES.COMMUNITY,
    links: [
      { label: '전체글', href: ROUTES.COMMUNITY },
      ...POST_CATEGORIES.map((c) => ({ label: c.label, href: `${ROUTES.COMMUNITY}?category=${c.value}` })),
      { label: '글쓰기', href: ROUTES.COMMUNITY_NEW },
    ],
  },
  {
    id: 'support',
    label: '고객센터',
    href: ROUTES.CONTACT,
    links: [
      { label: '문의하기', href: ROUTES.CONTACT },
      { label: '이용약관', href: '/terms' },
      { label: '개인정보처리방침', href: '/privacy' },
    ],
  },
  {
    id: 'partner',
    label: '제휴 서비스',
    navLabel: '웨딩 컨시어지(예식도우미)',
    href: PARTNER_URL,
    external: true,
    links: [{ label: '웨딩 컨시어지(예식도우미)', href: PARTNER_URL, external: true }],
  },
];

/** 드로어 검색창 아래 '추천' 바로가기 */
export const RECOMMENDED_LINKS = [
  { label: '예식장', href: `${ROUTES.JOBS}?businessType=venue` },
  { label: '드레스샵', href: `${ROUTES.JOBS}?businessType=dress` },
  { label: '스튜디오', href: `${ROUTES.JOBS}?businessType=studio` },
  { label: '메이크업', href: `${ROUTES.JOBS}?businessType=makeup` },
  { label: '웨딩플래너', href: `${ROUTES.JOBS}?businessType=planner` },
];
