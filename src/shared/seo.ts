// SEO 정본(canonical) 출력 전용 상수/헬퍼.
// 운영 도메인은 marie.co.kr 로 고정한다. NEXT_PUBLIC_APP_URL 은 프록시/이메일 용도로
// 값이 달라질 수 있어(운영에서 marie-wedding.hsweb.pics 로 설정됨) canonical/OG/sitemap
// 절대주소는 이 상수를 써서 항상 marie.co.kr 로 통일한다.
export const SITE_URL = 'https://marie.co.kr';
export const SITE_NAME = 'Marié';
export const SITE_NAME_KO = '마리에';
export const SITE_TAGLINE = '웨딩 업계 No.1 채용 플랫폼';
export const SITE_DESCRIPTION =
  '예식장·드레스·스튜디오·헤어메이크업·플래너까지, 웨딩 업계 채용 공고와 인재·업체 프로필을 한 곳에서. 마리에에서 웨딩 일자리와 인재를 찾아보세요.';

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
