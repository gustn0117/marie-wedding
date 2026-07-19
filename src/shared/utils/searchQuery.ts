// 검색어 정규화 — PostgREST .or() / .ilike() 인젝션 방지
// ',' : PostgREST OR 필터 구분자
// '(' ')': PostgREST or=(...) 논리트리 구분자 — 안 지우면 '스튜디오(강남점)' 처럼 괄호가
//          든 검색어가 그룹을 조기 종료해 매칭이 없어 '결과 0건'으로 조용히 사라진다.
// '%' '_': SQL 와일드카드
// 모두 공백으로 치환 후 trim. 빈 문자열이면 null 반환.

export function normalizeSearchTerm(value: string | null | undefined): string {
  if (!value) return '';
  return value
    // 유니코드 NFC 정규화 — IME/붙여넣기로 들어온 자모분해형(NFD) 한글을 조합형으로 통일해
    // ilike 매칭이 '같은 글자인데 0건'이 되지 않게 한다.
    .normalize('NFC')
    .replace(/[,%_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// .ilike() 인자용. normalize 후 %term% 패턴 생성. 빈 문자열이면 null.
export function buildIlikePattern(value: string | null | undefined): string | null {
  const term = normalizeSearchTerm(value);
  return term ? `%${term}%` : null;
}
