// 검색어 정규화 — PostgREST .or() / .ilike() 인젝션 방지
// ',' : PostgREST OR 필터 구분자
// '%' '_': SQL 와일드카드
// 모두 공백으로 치환 후 trim. 빈 문자열이면 null 반환.

export function normalizeSearchTerm(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[,%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// .ilike() 인자용. normalize 후 %term% 패턴 생성. 빈 문자열이면 null.
export function buildIlikePattern(value: string | null | undefined): string | null {
  const term = normalizeSearchTerm(value);
  return term ? `%${term}%` : null;
}
