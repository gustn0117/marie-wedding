// 채용 가이드(/guide/[slug]) 콘텐츠. 실제로 유용한 정보 페이지(도어웨이 아님).
// 검색(SEO)·AI 답변(GEO) 모두를 위해:
//  - 첫 문단(lead)은 '○○는 …입니다' 정의문으로 시작한다 — AI 가 그대로 인용하기 좋은 형태.
//  - 한눈에 보기·직무·흐름·역량·근무 형태·팁·FAQ 를 항목별로 나눠 구조가 드러나게 쓴다.
//  - 급여 수치·'공고가 많다' 같은 확인 안 된 사실은 쓰지 않는다(표시광고법·신뢰).
//  - 지역만 바꾼 복제 페이지는 만들지 않는다 — 가이드마다 다루는 질문이 달라야 한다.
// 본문은 분류별 파일(./guides/*)에 있다. 내용을 고치면 updatedAt 도 바꾼다(dateModified·사이트맵 lastmod).
import type { BusinessType } from '@/shared/constants';
import { JOB_CORE_GUIDES } from './guides/job-core';
import { JOB_VENUE_GUIDES } from './guides/job-venue';
import { JOB_HELPER_GUIDES } from './guides/job-helpers';
import { JOB_MEDIA_GUIDES } from './guides/job-media';
import { JOB_MORE_GUIDES } from './guides/job-more';
import { PREP_START_GUIDES } from './guides/prep-start';
import { PREP_CAREER_GUIDES } from './guides/prep-career';
import { EMPLOYER_GUIDES } from './guides/employer';
import { INDUSTRY_CEREMONY_GUIDES } from './guides/industry-ceremony';
import { INDUSTRY_BASICS_GUIDES } from './guides/industry-basics';

export interface LandingFact {
  label: string;
  value: string;
}

export interface LandingRole {
  name: string;
  desc: string;
  /** 관련 가이드로 이어지는 링크(있으면 카드 전체가 링크) */
  href?: string;
}

export interface LandingSection {
  /** 목차·앵커용 id(영문) */
  id: string;
  heading: string;
  body?: string[];
  /** '제목 — 설명' 형식이면 제목을 굵게 보여준다 */
  items?: string[];
  /** steps: 번호 흐름 · check: 체크리스트 · list: 점 목록 · terms: 용어 풀이('용어 — 뜻', DefinedTerm 구조화 데이터) */
  itemStyle?: 'steps' | 'check' | 'list' | 'terms';
  /** 비교표 — 첫 칸은 행 제목 */
  table?: { head: string[]; rows: string[][] };
  /** 섹션 끝 참고 문구(예외·확인할 곳) */
  note?: string;
}

/** 가이드 분류 — 가이드 모음(/guide)을 이 순서로 묶는다 */
export type GuideCategory = 'job' | 'prep' | 'employer' | 'industry';

export const GUIDE_CATEGORIES: { id: GuideCategory; label: string; lead: string }[] = [
  {
    id: 'job',
    label: '직무 가이드',
    lead: '웨딩 업계 직무별로 하는 일과 필요한 역량, 근무 형태와 시작하는 방법을 정리했습니다.',
  },
  {
    id: 'prep',
    label: '취업·알바 준비',
    lead: '복장과 준비물, 보건증, 이력서와 면접, 포트폴리오까지 웨딩 업계에서 일을 시작하기 전에 챙길 것을 정리했습니다.',
  },
  {
    id: 'employer',
    label: '채용 담당자 가이드',
    lead: '공고 작성과 면접, 단기 인력 운영, 신입 교육까지 웨딩 업체의 채용 실무를 정리했습니다.',
  },
  {
    id: 'industry',
    label: '웨딩 업계 이해',
    lead: '예식 순서와 웨딩 용어, 스드메와 웨딩홀 계약 구조처럼 웨딩 업계에서 일하려면 알아 두어야 할 기본 지식을 정리했습니다.',
  },
];

export interface Landing {
  slug: string;
  category: GuideCategory;
  /** 대표 가이드 — 모든 페이지 푸터와 서비스 소개에 링크가 걸린다 */
  featured?: boolean;
  /** 이 가이드가 다루는 업종(BUSINESS_TYPES value). 빈 배열이면 전체 업종. 최신 공고·목록 링크에 쓴다. */
  businessTypes: BusinessType[];
  keywords: string[];
  title: string; // <title> (템플릿이 ' | 마리에' 부착)
  description: string;
  /** 짧은 이름 — 푸터·목록 링크 글자 */
  eyebrow: string;
  h1: string;
  /** 첫 문단 — 정의문으로 시작 */
  lead: string;
  /** 한눈에 보기 — 3~4개 */
  summary?: LandingFact[];
  rolesHeading?: string;
  roles?: LandingRole[];
  sections: LandingSection[];
  career?: { steps: string[]; note: string };
  /** 구직자·업체 팁 — 한쪽만 있어도 된다 */
  tips?: { seeker?: string[]; employer?: string[] };
  faq: { q: string; a: string }[];
  /** Occupation 구조화 데이터(직무 가이드만) */
  occupation?: { name: string; alternateNames: string[]; skills: string[] };
  /** 함께 보면 좋은 가이드 slug — 아래 추천 목록 맨 앞에 온다 */
  related?: string[];
  publishedAt: string; // YYYY-MM-DD
  updatedAt: string; // YYYY-MM-DD
}

export const LANDINGS: Landing[] = [
  ...JOB_CORE_GUIDES,
  ...JOB_VENUE_GUIDES,
  ...JOB_HELPER_GUIDES,
  ...JOB_MEDIA_GUIDES,
  ...JOB_MORE_GUIDES,
  ...PREP_START_GUIDES,
  ...PREP_CAREER_GUIDES,
  ...EMPLOYER_GUIDES,
  ...INDUSTRY_CEREMONY_GUIDES,
  ...INDUSTRY_BASICS_GUIDES,
];

const BY_SLUG = new Map(LANDINGS.map((l) => [l.slug, l]));

export function getLanding(slug: string): Landing | undefined {
  return BY_SLUG.get(slug);
}

/** 분류별 가이드 — 대표 가이드를 앞에, 나머지는 등록 순서대로 */
export function guidesIn(category: GuideCategory): Landing[] {
  const list = LANDINGS.filter((l) => l.category === category);
  return [...list.filter((l) => l.featured), ...list.filter((l) => !l.featured)];
}

/**
 * 함께 보면 좋은 가이드 — 직접 고른 것(related) → 같은 분류(자기 다음 순서부터 돌아가며) → 대표 가이드.
 * 같은 분류를 '다음 순서부터' 채워서 가이드마다 서로 다른 이웃에 링크가 고르게 퍼지게 한다.
 */
export function relatedGuides(landing: Landing, limit = 8): Landing[] {
  const picked: Landing[] = [];
  const add = (l: Landing | undefined) => {
    if (l && l.slug !== landing.slug && !picked.includes(l)) picked.push(l);
  };
  landing.related?.forEach((slug) => add(getLanding(slug)));
  const same = LANDINGS.filter((l) => l.category === landing.category);
  const at = same.findIndex((l) => l.slug === landing.slug);
  [...same.slice(at + 1), ...same.slice(0, Math.max(at, 0))].forEach(add);
  LANDINGS.filter((l) => l.featured).forEach(add);
  return picked.slice(0, limit);
}

/** '제목 — 설명' 을 [제목, 설명] 으로. 구분자가 없으면 [null, 전체] */
export function splitGuideItem(text: string): [string | null, string] {
  const at = text.indexOf(' — ');
  return at > 0 ? [text.slice(0, at), text.slice(at + 3)] : [null, text];
}

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' (화면 표기) */
export function formatGuideDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** 구조화 데이터·OG 용 ISO 시각(KST 자정) */
export function guideDateIso(date: string): string {
  return `${date}T00:00:00+09:00`;
}
