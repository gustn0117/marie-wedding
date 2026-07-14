import type {
  ResumeContent,
  ResumeDegree,
  ResumeLanguageLevel,
  ResumeRecord,
  ResumeSnapshot,
  SubmittedResumeSnapshot,
} from '@/features/resumes/types';

export const RESUME_SELECT_COLUMNS =
  'id, profile_id, title, is_default, photo_path, full_name, email, phone, birth_date, address, headline, summary, desired_roles, desired_regions, desired_employment_types, skills, educations, experiences, certificates, languages, links, completeness_score, version, last_used_at, created_at, updated_at, deleted_at' as const;

type ResumeRow = Record<string, unknown>;

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function mapResumeRow(row: ResumeRow): ResumeRecord {
  return {
    id: string(row.id),
    profileId: string(row.profile_id),
    title: string(row.title),
    isDefault: row.is_default === true,
    photoPath: typeof row.photo_path === 'string' ? row.photo_path : null,
    fullName: string(row.full_name),
    email: string(row.email),
    phone: string(row.phone),
    birthDate: string(row.birth_date),
    address: string(row.address),
    headline: string(row.headline),
    summary: string(row.summary),
    desiredRoles: array<string>(row.desired_roles),
    desiredRegions: array<string>(row.desired_regions),
    desiredEmploymentTypes: array<string>(row.desired_employment_types),
    skills: array<string>(row.skills),
    educations: array<ResumeRecord['educations'][number]>(row.educations),
    experiences: array<ResumeRecord['experiences'][number]>(row.experiences),
    certificates: array<ResumeRecord['certificates'][number]>(row.certificates),
    languages: array<ResumeRecord['languages'][number]>(row.languages),
    links: array<ResumeRecord['links'][number]>(row.links),
    completenessScore: typeof row.completeness_score === 'number' ? row.completeness_score : 0,
    version: typeof row.version === 'number' ? row.version : 1,
    lastUsedAt: typeof row.last_used_at === 'string' ? row.last_used_at : null,
    createdAt: string(row.created_at),
    updatedAt: string(row.updated_at),
  };
}

export function resumeContentToRow(
  content: ResumeContent,
  options: { isDefault: boolean; completenessScore: number },
) {
  return {
    title: content.title,
    is_default: options.isDefault,
    photo_path: content.photoPath,
    full_name: content.fullName,
    email: content.email || null,
    phone: content.phone || null,
    birth_date: content.birthDate || null,
    address: content.address || null,
    headline: content.headline || null,
    summary: content.summary || '',
    desired_roles: content.desiredRoles,
    desired_regions: content.desiredRegions,
    desired_employment_types: content.desiredEmploymentTypes,
    skills: content.skills,
    educations: content.educations,
    experiences: content.experiences,
    certificates: content.certificates,
    languages: content.languages,
    links: content.links,
    completeness_score: options.completenessScore,
  };
}

export function parseSubmittedResumeSnapshot(value: unknown): SubmittedResumeSnapshot | null {
  const snapshot = record(value);
  if (!snapshot) return null;
  if (snapshot.schemaVersion !== 1) return null;
  if (snapshot.redacted === true) {
    return { schemaVersion: 1, redacted: true, title: string(snapshot.title) || '삭제된 이력서' };
  }

  const resumeId = string(snapshot.resumeId);
  const submittedAt = string(snapshot.submittedAt);
  if (!resumeId || !submittedAt) return null;

  const result: ResumeSnapshot = {
    schemaVersion: 1,
    resumeId,
    resumeVersion: positiveInteger(snapshot.resumeVersion, 1),
    submittedAt,
    completenessScore: boundedScore(snapshot.completenessScore),
    title: string(snapshot.title),
    photoPath: typeof snapshot.photoPath === 'string' ? snapshot.photoPath : null,
    fullName: string(snapshot.fullName),
    email: string(snapshot.email),
    phone: string(snapshot.phone),
    birthDate: string(snapshot.birthDate),
    address: string(snapshot.address),
    headline: string(snapshot.headline),
    summary: string(snapshot.summary),
    desiredRoles: stringArray(snapshot.desiredRoles),
    desiredRegions: stringArray(snapshot.desiredRegions),
    desiredEmploymentTypes: stringArray(snapshot.desiredEmploymentTypes),
    skills: stringArray(snapshot.skills),
    educations: recordArray(snapshot.educations).map((item, index) => ({
      id: string(item.id) || `education-${index}`,
      school: string(item.school),
      major: string(item.major),
      degree: resumeDegree(item.degree),
      startDate: string(item.startDate),
      endDate: string(item.endDate),
      isCurrent: item.isCurrent === true,
      description: string(item.description),
    })),
    experiences: recordArray(snapshot.experiences).map((item, index) => ({
      id: string(item.id) || `experience-${index}`,
      company: string(item.company),
      position: string(item.position),
      startDate: string(item.startDate),
      endDate: string(item.endDate),
      isCurrent: item.isCurrent === true,
      description: string(item.description),
    })),
    certificates: recordArray(snapshot.certificates).map((item, index) => ({
      id: string(item.id) || `certificate-${index}`,
      name: string(item.name),
      issuer: string(item.issuer),
      acquiredDate: string(item.acquiredDate),
      credentialId: string(item.credentialId),
    })),
    languages: recordArray(snapshot.languages).map((item, index) => ({
      id: string(item.id) || `language-${index}`,
      language: string(item.language),
      level: languageLevel(item.level),
      testName: string(item.testName),
      score: string(item.score),
    })),
    links: recordArray(snapshot.links).map((item, index) => ({
      id: string(item.id) || `link-${index}`,
      label: string(item.label),
      url: httpUrl(item.url),
    })).filter((item) => item.url),
  };
  return result;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function boundedScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : 0;
}

function resumeDegree(value: unknown): ResumeDegree {
  return value === 'high_school' || value === 'associate' || value === 'bachelor'
    || value === 'master' || value === 'doctorate' || value === 'other'
    ? value
    : 'other';
}

function languageLevel(value: unknown): ResumeLanguageLevel {
  return value === 'basic' || value === 'conversational' || value === 'business' || value === 'native'
    ? value
    : 'basic';
}

function httpUrl(value: unknown): string {
  const url = string(value);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}
