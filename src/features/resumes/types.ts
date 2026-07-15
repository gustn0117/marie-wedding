export type ResumeDegree =
  | 'high_school'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'doctorate'
  | 'other';

export type ResumeLanguageLevel = 'basic' | 'conversational' | 'business' | 'native';

export interface ResumeEducation {
  id: string;
  school: string;
  major: string;
  degree: ResumeDegree;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
}

export interface ResumeExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
}

export interface ResumeCertificate {
  id: string;
  name: string;
  issuer: string;
  acquiredDate: string;
  credentialId: string;
}

export interface ResumeLanguage {
  id: string;
  language: string;
  level: ResumeLanguageLevel;
  testName: string;
  score: string;
}

export interface ResumeLink {
  id: string;
  label: string;
  url: string;
}

export interface ResumeContent {
  title: string;
  photoPath: string | null;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  headline: string;
  summary: string;
  desiredRoles: string[];
  desiredRegions: string[];
  desiredEmploymentTypes: string[];
  skills: string[];
  educations: ResumeEducation[];
  experiences: ResumeExperience[];
  certificates: ResumeCertificate[];
  languages: ResumeLanguage[];
  links: ResumeLink[];
}

export interface ResumeRecord extends ResumeContent {
  id: string;
  profileId: string;
  isDefault: boolean;
  completenessScore: number;
  version: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSnapshot extends ResumeContent {
  schemaVersion: 1;
  resumeId: string;
  resumeVersion: number;
  submittedAt: string;
  completenessScore: number;
  redacted?: false;
}

export interface RedactedResumeSnapshot {
  schemaVersion: 1;
  redacted: true;
  title: string;
}

export type SubmittedResumeSnapshot = ResumeSnapshot | RedactedResumeSnapshot;

export const RESUME_DEGREE_LABELS: Record<ResumeDegree, string> = {
  high_school: '고등학교',
  associate: '전문학사',
  bachelor: '학사',
  master: '석사',
  doctorate: '박사',
  other: '기타',
};

export const RESUME_LANGUAGE_LEVEL_LABELS: Record<ResumeLanguageLevel, string> = {
  basic: '기초',
  conversational: '일상 회화',
  business: '비즈니스',
  native: '원어민 수준',
};

export const RESUME_SUBMISSION_MIN_SCORE = 60;

export function isValidResumePhone(value: string): boolean {
  const phone = value.trim();
  if (!phone || phone.length > 40 || !/^[0-9+().\-\s]+$/.test(phone)) return false;
  const digitCount = phone.replace(/\D/g, '').length;
  return digitCount >= 9 && digitCount <= 15;
}

export function isValidResumeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function createEmptyResumeContent(title = '새 이력서'): ResumeContent {
  return {
    title,
    photoPath: null,
    fullName: '',
    email: '',
    phone: '',
    birthDate: '',
    address: '',
    headline: '',
    summary: '',
    desiredRoles: [],
    desiredRegions: [],
    desiredEmploymentTypes: [],
    skills: [],
    educations: [],
    experiences: [],
    certificates: [],
    languages: [],
    links: [],
  };
}

export function calculateResumeCompleteness(content: ResumeContent): number {
  let score = 0;
  if (content.photoPath) score += 10;
  if (content.fullName.trim()) score += 10;
  if (isValidResumeEmail(content.email) || isValidResumePhone(content.phone)) score += 10;
  if (content.headline.trim()) score += 10;
  if (content.summary.trim().length >= 30) score += 20;
  if (content.educations.some((item) => item.school.trim())) score += 15;
  if (content.experiences.some((item) => item.company.trim() && item.position.trim())) score += 15;
  if (content.certificates.some((item) => item.name.trim()) || content.skills.length > 0) score += 5;
  if (content.desiredRoles.length > 0) score += 5;
  return score;
}

export function isResumeContentSubmittable(
  content: ResumeContent,
  score = calculateResumeCompleteness(content),
): boolean {
  return score >= RESUME_SUBMISSION_MIN_SCORE && content.fullName.trim().length > 0;
}
