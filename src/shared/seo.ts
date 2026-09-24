// SEO 정본(canonical) 출력 전용 상수/헬퍼.
// 운영 도메인은 marie.co.kr 로 고정한다. NEXT_PUBLIC_APP_URL 은 프록시/이메일 용도로
// 값이 달라질 수 있어(운영에서 marie-wedding.hsweb.pics 로 설정됨) canonical/OG/sitemap
// 절대주소는 이 상수를 써서 항상 marie.co.kr 로 통일한다.
import type { Metadata } from 'next';

export const SITE_URL = 'https://marie.co.kr';
export const SITE_HOST = 'marie.co.kr';
export const SITE_NAME = 'Marié';
export const SITE_NAME_KO = '마리에';
// 근거 없는 최상급('No.1')은 표시광고법상 부당표시 소지가 있어 쓰지 않는다.
// 전문성(웨딩만 다룬다)은 사실이라 근거를 요구받지 않으면서도 차별점이 된다.
export const SITE_TAGLINE = '웨딩 업계 전문 채용 플랫폼';
export const SITE_DESCRIPTION =
  '예식장·드레스·스튜디오·헤어메이크업·플래너까지, 웨딩 업계 채용 공고와 인재·업체 프로필을 한 곳에서. 마리에에서 웨딩 일자리와 인재를 찾아보세요.';
export const CONTACT_EMAIL_DEFAULT = 'admin@marie.co.kr';

// og:site_name — 한글 브랜드 + 영문 표기.
export const OG_SITE_NAME = `${SITE_NAME_KO} ${SITE_NAME}`;
// <title> 접미사. 사람들이 검색창에 치는 건 한글 '마리에'라 제목에도 한글 브랜드를 붙인다.
export const TITLE_SUFFIX = ` | ${SITE_NAME_KO}`;
export const DEFAULT_OG_IMAGE = '/og-marie.png';

interface PageMetadataInput {
  /** 페이지 고유 제목. 루트 템플릿이 ' | 마리에' 를 붙인다. */
  title: string;
  description: string;
  /** canonical 경로(예: '/jobs') */
  path: string;
  type?: 'website' | 'article' | 'profile';
  keywords?: string[];
  /** og/twitter 이미지. null 이면 지정하지 않는다(opengraph-image 파일을 쓰는 라우트). */
  image?: string | null;
}

/**
 * 페이지 메타데이터 한 벌(canonical·og·twitter).
 * Next 는 openGraph/twitter 를 부모와 병합하지 않고 통째로 덮어쓴다. 페이지가 openGraph 를
 * 일부만 적으면 루트의 이미지·site_name·locale 이 빠져 카톡·네이버 미리보기가 비므로
 * 공개 페이지는 항상 이 헬퍼로 전부 채운다.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  type = 'website',
  keywords,
  image = DEFAULT_OG_IMAGE,
}: PageMetadataInput): Metadata {
  const fullTitle = `${title}${TITLE_SUFFIX}`;
  const images = !image
    ? undefined
    : image === DEFAULT_OG_IMAGE
      ? [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: OG_SITE_NAME }]
      : [{ url: image, alt: title }];
  return {
    title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: OG_SITE_NAME,
      locale: 'ko_KR',
      title: fullTitle,
      description,
      url: path,
      ...(images ? { images } : {}),
    } as Metadata['openGraph'],
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      ...(images ? { images } : {}),
    },
  };
}

/** 운영 주체(Organization) 구조화 데이터 — 홈·서비스 소개가 같은 정의를 쓴다. */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: OG_SITE_NAME,
    alternateName: [SITE_NAME_KO, SITE_NAME, 'Marie'],
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630 },
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    description: SITE_DESCRIPTION,
    slogan: SITE_TAGLINE,
    email: CONTACT_EMAIL_DEFAULT,
    areaServed: { '@type': 'Country', name: 'KR' },
    knowsAbout: ['웨딩 채용', '웨딩 구인구직', '예식장', '드레스샵', '웨딩 스튜디오', '웨딩 헤어메이크업', '웨딩플래너', '예식 도우미'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: CONTACT_EMAIL_DEFAULT,
      url: absoluteUrl('/contact'),
      availableLanguage: ['ko'],
    },
  };
}

/** FAQPage 구조화 데이터. 화면에 보이는 질문·답과 같은 내용만 넣는다. */
export function faqJsonLd(faq: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** 상대 경로(또는 이미 절대주소)를 canonical 절대주소로 변환. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** 사용자가 입력한 외부 URL 을 절대 URI 로 정규화(스킴 없으면 https:// 부착). 레거시 데이터 대비. */
export function normalizeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** BreadcrumbList 구조화 데이터. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** HTML 본문 → 메타 설명용 평문(길이 제한, 말줄임). */
export function toPlainText(html: string | null | undefined, max = 160): string {
  const text = (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
