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

export function serializeSections(s: JobSectionMap): string {
  const blocks: string[] = [];
  for (const sec of JOB_SECTIONS) {
    const v = s[sec.key].trim();
    if (!v) continue;
    const html = v.split(/\n+/).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
    blocks.push(`<h3>${escapeHtml(sec.title)}</h3>${html}`);
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
  while ((m = pattern.exec(html)) !== null) {
    const heading = m[1].trim();
    const body = m[2].trim();
    const k = SECTION_LABEL_TO_KEY[heading];
    if (k) {
      const plain = htmlToPlain(body);
      if (plain) map[k] = (map[k] ? map[k] + '\n' : '') + plain;
      matched++;
    } else if (body) {
      const plain = htmlToPlain(body);
      if (plain) map.extra = (map.extra ? map.extra + '\n' : '') + plain;
    }
  }

  if (matched === 0) {
    map.extra = htmlToPlain(html);
    return { sections: map, fallbackUsed: true };
  }
  return { sections: map, fallbackUsed: false };
}
