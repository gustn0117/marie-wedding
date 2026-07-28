/**
 * 관리자 API 공용 — 공고 본문 필드 파싱·검증.
 * 대행 등록(/api/admin/proxy-jobs)과 일반 공고 수정(/api/admin/jobs)이 같은 규칙을 쓴다.
 * 사용자 등록 경로 /api/jobs/write 와 동일한 상한·역전 검사.
 */

/**
 * 마감일 정규화 — 날짜만 온 값을 KST 그날 끝으로 맞춘다.
 * (안 맞추면 마감일 당일 오전에 조기 마감된다)
 */
export const normalizeDeadline = (d?: string | null): string | null =>
  !d ? null : (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59+09:00` : d);

const MAX_SALARY = 100_000_000;
const JOB_IMAGES_MAX = 8;

/** 갤러리 경로 검증 — 버킷 밖을 가리키거나 상위로 빠져나가는 값을 거른다. */
function normalizeImages(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.length <= 300 && !p.includes('..') && !p.startsWith('/') && !/^https?:/i.test(p));
  return cleaned.length > 0 ? cleaned.slice(0, JOB_IMAGES_MAX) : null;
}

export function readJobFields(body: Record<string, unknown>):
  | { error: string }
  | { fields: Record<string, unknown> } {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const businessType = typeof body.businessType === 'string' ? body.businessType : '';
  const employmentType = typeof body.employmentType === 'string' ? body.employmentType : '';
  const region = typeof body.region === 'string' ? body.region : '';
  const salaryInfo = typeof body.salaryInfo === 'string' ? body.salaryInfo.trim() : '';
  const num = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);
  const salaryMin = num(body.salaryMin);
  const salaryMax = num(body.salaryMax);
  const salaryUnit = ['monthly', 'yearly', 'daily', 'hourly'].includes(String(body.salaryUnit))
    ? String(body.salaryUnit) : 'monthly';
  const experienceMin = num(body.experienceMin);
  const deadline = typeof body.deadline === 'string' ? body.deadline : '';
  const image = typeof body.image === 'string' && body.image.trim() ? body.image.trim() : null;
  const images = normalizeImages(body.images);

  if (!title || !description || !businessType || !employmentType || !region) {
    return { error: '공고 제목·내용·업종·고용형태·지역은 필수입니다.' };
  }
  for (const [label, v] of [['최소', salaryMin], ['최대', salaryMax]] as const) {
    if (v !== null && (v < 0 || v > MAX_SALARY)) return { error: `급여 ${label}값이 올바르지 않습니다.` };
  }
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { error: '급여 최소값이 최대값보다 클 수 없습니다.' };
  }
  if (experienceMin !== null && (experienceMin < 0 || experienceMin > 50)) {
    return { error: '최소 경력 값이 올바르지 않습니다.' };
  }

  return {
    fields: {
      title: title.slice(0, 200),
      description,
      business_type: businessType,
      employment_type: employmentType,
      region,
      salary_info: salaryInfo || null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_unit: salaryUnit,
      experience_min: experienceMin,
      deadline: normalizeDeadline(deadline),
      image,
      images,
    },
  };
}
