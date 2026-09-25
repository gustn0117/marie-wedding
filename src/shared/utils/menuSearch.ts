import type { SiteMenuSection } from '@/shared/constants/siteMenu';

/** 전체메뉴 검색 대상 한 줄 — 메뉴 이름과 상위 분류 경로. */
export interface MenuSearchEntry {
  label: string;
  /** 상위 분류(드로어 좌측 대분류 › 펼침 항목). 대분류 자체는 빈 배열. */
  path: string[];
  href: string;
  external?: boolean;
}

/** 드로어에 보이는 메뉴(대분류 · 하위 메뉴 · 펼침 항목)를 검색용 목록으로 편다. */
export function buildMenuSearchIndex(sections: SiteMenuSection[], extra: MenuSearchEntry[] = []): MenuSearchEntry[] {
  const entries: MenuSearchEntry[] = [];
  for (const section of sections) {
    entries.push({ label: section.label, path: [], href: section.href, external: section.external });
    for (const link of section.links) {
      entries.push({ label: link.label, path: [section.label], href: link.href, external: link.external });
      for (const child of link.children ?? []) {
        entries.push({ label: child.label, path: [section.label, link.label], href: child.href });
      }
    }
  }
  return [...entries, ...extra];
}

// '인재 업체' 와 '인재·업체', '업체프로필' 과 '업체 프로필' 이 서로 찾아지도록 공백·구두점을 무시한다.
const normalize = (value: string) => value.toLowerCase().replace(/[\s·・()[\]\-_/.,]+/g, '');

/**
 * 메뉴 검색. 검색어의 모든 단어가 '메뉴 이름 + 상위 분류'에 들어 있고, 적어도 한 단어는
 * 메뉴 이름에 있어야 한다 — '프로필'로 찾을 때 상위 분류만 겹치는 업종 9개가 쏟아지지 않게.
 * ('드레스샵 프로필'처럼 분류를 함께 적으면 그 분류의 드레스샵만 나온다.)
 * 정렬: 이름이 검색어와 같음 → 검색어를 포함 → 단어별로만 일치. 같은 등급이면 얕은 메뉴(대분류)부터,
 * 그다음 드로어에 보이는 순서('공고' → 전체 공고 · 업종별 공고 · 공고 등록).
 */
export function searchMenu(index: MenuSearchEntry[], query: string, limit = 30): MenuSearchEntry[] {
  const tokens = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  if (tokens.length === 0) return [];
  const whole = normalize(query);

  const scored: { entry: MenuSearchEntry; rank: number; order: number }[] = [];
  index.forEach((entry, order) => {
    const label = normalize(entry.label);
    const haystack = label + normalize(entry.path.join(''));
    if (!tokens.every((t) => haystack.includes(t))) return;
    if (!tokens.some((t) => label.includes(t))) return;
    const match = label === whole ? 0 : label.includes(whole) ? 1 : 2;
    scored.push({ entry, rank: match * 10 + entry.path.length, order });
  });
  scored.sort((a, b) => a.rank - b.rank || a.order - b.order);

  const seen = new Set<string>();
  const results: MenuSearchEntry[] = [];
  for (const { entry } of scored) {
    const key = `${entry.label}|${entry.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(entry);
    if (results.length >= limit) break;
  }
  return results;
}
