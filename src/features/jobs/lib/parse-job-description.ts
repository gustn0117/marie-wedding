/**
 * 공고 description HTML을 5개 섹션으로 분해/직렬화하는 공용 헬퍼.
 *
 * - serializeSections: 5개 textarea → 단일 HTML (저장용)
 * - parseSections    : 저장된 HTML → 5개 섹션 객체 (수정 폼·상세 페이지 표시용)
 *
 * JobForm은 작성·수정 시 사용, 상세 페이지 JobDescriptionView는 표시 시 사용한다.
 */

export const JOB_SECTIONS = [
  { key: 'duty',         title: '담당 업무' },
  { key: 'requirements', title: '지원 자격' },
  { key: 'conditions',   title: '근무 조건' },
  { key: 'apply',        title: '지원 시 알려주세요' },
  { key: 'extra',        title: '기타 상세 내용' },
] as const;

export type JobSectionKey = (typeof JOB_SECTIONS)[number]['key'];
export type JobSectionMap = Record<JobSectionKey, string>;

export const EMPTY_JOB_SECTIONS: JobSectionMap = {
  duty: '',
  requirements: '',
  conditions: '',
  apply: '',
  extra: '',
};

const SECTION_LABEL_TO_KEY: Record<string, JobSectionKey> = {
  '담당 업무': 'duty',
  '담당업무': 'duty',
  '업무': 'duty',
  '주요 업무': 'duty',
  '주요업무': 'duty',
  '지원 자격': 'requirements',
  '지원자격': 'requirements',
  '자격 요건': 'requirements',
  '자격요건': 'requirements',
  '필수 자격': 'requirements',
  '필수자격': 'requirements',
  '근무 조건': 'conditions',
  '근무조건': 'conditions',
  '근무 환경': 'conditions',
  '우대 사항': 'extra',
  '우대사항': 'extra',
  '지원 시 알려주세요': 'apply',
  '지원시 알려주세요': 'apply',
  '지원 방법': 'apply',
  '지원방법': 'apply',
  '제출 서류': 'apply',
  '기타': 'extra',
  '기타 상세 내용': 'extra',
  '기타 사항': 'extra',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 섹션에 실질 내용(텍스트 또는 이미지)이 있는지 */
export function sectionHasContent(html: string): boolean {
  if (!html) return false;
  // 태그를 제거해 '실제 텍스트'만 확인한다. htmlToPlain 은 <li> 를 '· ' 로 치환하므로
  // 빈 글머리(<ul><li></li></ul>)를 '내용 있음'으로 오판한다 — 여기선 마커 없이 검사.
  const text = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .trim();
  return text.length > 0 || /<img/i.test(html);
}

// 섹션은 이제 RichTextEditor 가 만든 HTML(문단·이미지·서식 포함)을 그대로 담는다.
export function serializeSections(s: JobSectionMap): string {
  const blocks: string[] = [];
  for (const sec of JOB_SECTIONS) {
    let v = (s[sec.key] || '').trim();
    if (!sectionHasContent(v)) continue;
    // 빈 글머리 항목(<li></li>, <li><br></li>) 제거 — 마지막 줄에서 Enter 로 남긴 빈 불릿 정리.
    v = v.replace(/<li>(?:\s|&nbsp;|<br\s*\/?>)*<\/li>/gi, '');
    // 항목이 모두 빠져 껍데기만 남은 목록 태그도 제거.
    v = v.replace(/<(ul|ol)>\s*<\/\1>/gi, '');
    blocks.push(`<h3>${escapeHtml(sec.title)}</h3>${v}`);
  }
  return blocks.join('');
}

/**
 * description HTML을 5개 섹션으로 분해.
 * 헤더 패턴이 인식되면 분리, 안 되면 전체를 'extra'에 폴백.
 * 추가로 fallbackUsed 플래그를 함께 반환해 상세 페이지에서 단일 본문으로 렌더할지 결정 가능.
 */
export function parseSections(html: string): { sections: JobSectionMap; fallbackUsed: boolean } {
  const map: JobSectionMap = { ...EMPTY_JOB_SECTIONS };
  if (!html?.trim()) return { sections: map, fallbackUsed: false };

  const pattern = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>([\s\S]*?)(?=<h[1-6][^>]*>|$)/gi;
  let m: RegExpExecArray | null;
  let matched = 0;
  let currentKey: JobSectionKey | null = null;
  while ((m = pattern.exec(html)) !== null) {
    const heading = m[1].trim();
    const body = m[2].trim();
    const k = SECTION_LABEL_TO_KEY[heading];
    if (k) {
      // 본문 HTML(문단·이미지·서식)을 그대로 유지 — 리치 에디터로 다시 편집 가능하도록
      currentKey = k;
      if (body) map[k] = (map[k] || '') + body;
      matched++;
    } else {
      // 알려진 섹션 라벨이 아닌 헤더 = 사용자가 본문에 직접 넣은 소제목(대/중 버튼 h2·h3).
      // 구분자로 오인하면 소제목 텍스트가 사라지고 그 뒤 본문이 엉뚱한 카드로 이동한다.
      // 소제목 마크업(m[0])째 현재 섹션(없으면 extra)에 되붙여 원문을 보존한다.
      const target = currentKey ?? 'extra';
      map[target] = (map[target] || '') + m[0];
    }
  }

  if (matched === 0) {
    map.extra = html;
    return { sections: map, fallbackUsed: true };
  }
  return { sections: map, fallbackUsed: false };
}
