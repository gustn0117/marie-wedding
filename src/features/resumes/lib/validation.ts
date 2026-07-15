import type {
  ResumeCertificate,
  ResumeContent,
  ResumeDegree,
  ResumeEducation,
  ResumeExperience,
  ResumeLanguage,
  ResumeLanguageLevel,
  ResumeLink,
  ResumeAttachment,
} from '@/features/resumes/types';
import { calculateResumeCompleteness, isValidResumePhone } from '@/features/resumes/types';
import { isCanonicalResumePhotoPath, isCanonicalResumeAttachmentPath } from '@/features/resumes/lib/photo';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEGREES = new Set<ResumeDegree>(['high_school', 'associate', 'bachelor', 'master', 'doctorate', 'other']);
const LANGUAGE_LEVELS = new Set<ResumeLanguageLevel>(['basic', 'conversational', 'business', 'native']);

export interface ParsedResumeInput {
  content: ResumeContent;
  isDefault: boolean;
  completenessScore: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function text(value: unknown, max: number, field: string, required = false): string {
  if (value === null || value === undefined) value = '';
  if (typeof value !== 'string') throw new Error(`${field} 형식이 올바르지 않습니다.`);
  const normalized = value.trim();
  if (required && !normalized) throw new Error(`${field}을(를) 입력해주세요.`);
  if (normalized.length > max) throw new Error(`${field}은(는) ${max}자 이하로 입력해주세요.`);
  return normalized;
}

function rowId(value: unknown): string {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : crypto.randomUUID();
}

function month(value: unknown, field: string): string {
  const normalized = text(value, 7, field);
  if (normalized && !MONTH_PATTERN.test(normalized)) throw new Error(`${field} 형식이 올바르지 않습니다.`);
  if (normalized) {
    const year = Number(normalized.slice(0, 4));
    if (year < 1900 || year > new Date().getUTCFullYear() + 10) throw new Error(`${field} 날짜가 올바르지 않습니다.`);
  }
  return normalized;
}

function date(value: unknown, field: string): string {
  const normalized = text(value, 10, field);
  if (normalized && !DATE_PATTERN.test(normalized)) throw new Error(`${field} 형식이 올바르지 않습니다.`);
  if (normalized) {
    const [year, monthValue, day] = normalized.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, monthValue - 1, day));
    const latestAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (year < 1900 || parsed.toISOString().slice(0, 10) !== normalized || normalized > latestAllowed) {
      throw new Error(`${field} 날짜가 올바르지 않습니다.`);
    }
  }
  return normalized;
}

function stringList(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${field} 항목이 너무 많습니다.`);
  return Array.from(new Set(value.map((item) => text(item, maxLength, field)).filter(Boolean)));
}

function objectList(value: unknown, field: string, maxItems: number): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => !isPlainObject(item))) {
    throw new Error(`${field} 형식이 올바르지 않습니다.`);
  }
  return value as Record<string, unknown>[];
}

function parseEducations(value: unknown): ResumeEducation[] {
  return objectList(value, '학력', 10).map((item) => {
    const degree = text(item.degree, 20, '학위') as ResumeDegree;
    if (!DEGREES.has(degree)) throw new Error('학위 형식이 올바르지 않습니다.');
    const isCurrent = item.isCurrent === true;
    const startDate = month(item.startDate, '입학일');
    const endDate = isCurrent ? '' : month(item.endDate, '졸업일');
    if (startDate && endDate && endDate < startDate) throw new Error('졸업일은 입학일보다 빠를 수 없습니다.');
    return {
      id: rowId(item.id),
      school: text(item.school, 100, '학교명'),
      major: text(item.major, 100, '전공'),
      degree,
      startDate,
      endDate,
      isCurrent,
      description: text(item.description, 1000, '학력 설명'),
    };
  });
}

function parseExperiences(value: unknown): ResumeExperience[] {
  return objectList(value, '경력', 20).map((item) => {
    const isCurrent = item.isCurrent === true;
    const startDate = month(item.startDate, '입사일');
    const endDate = isCurrent ? '' : month(item.endDate, '퇴사일');
    if (startDate && endDate && endDate < startDate) throw new Error('퇴사일은 입사일보다 빠를 수 없습니다.');
    return {
      id: rowId(item.id),
      company: text(item.company, 100, '회사명'),
      position: text(item.position, 100, '직책/담당업무'),
      startDate,
      endDate,
      isCurrent,
      description: text(item.description, 2000, '경력 설명'),
    };
  });
}

function parseCertificates(value: unknown): ResumeCertificate[] {
  return objectList(value, '자격증', 20).map((item) => ({
    id: rowId(item.id),
    name: text(item.name, 100, '자격증명'),
    issuer: text(item.issuer, 100, '발급기관'),
    acquiredDate: date(item.acquiredDate, '취득일'),
    credentialId: text(item.credentialId, 100, '자격번호'),
  }));
}

function parseLanguages(value: unknown): ResumeLanguage[] {
  return objectList(value, '외국어', 10).map((item) => {
    const level = text(item.level, 20, '외국어 수준') as ResumeLanguageLevel;
    if (!LANGUAGE_LEVELS.has(level)) throw new Error('외국어 수준 형식이 올바르지 않습니다.');
    return {
      id: rowId(item.id),
      language: text(item.language, 50, '언어'),
      level,
      testName: text(item.testName, 100, '시험명'),
      score: text(item.score, 50, '점수/등급'),
    };
  });
}

function parseLinks(value: unknown): ResumeLink[] {
  return objectList(value, '링크', 10).map((item) => {
    const url = text(item.url, 500, '링크 주소');
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
      } catch {
        throw new Error('링크는 http:// 또는 https:// 주소로 입력해주세요.');
      }
    }
    return {
      id: rowId(item.id),
      label: text(item.label, 60, '링크 이름'),
      url,
    };
  });
}

function parseAttachments(value: unknown, userId: string): ResumeAttachment[] {
  return objectList(value, '첨부파일', 5)
    .map((item) => {
      const path = text(item.path, 300, '첨부파일 경로');
      if (path && !isCanonicalResumeAttachmentPath(path, userId)) {
        throw new Error('본인이 올린 포트폴리오 파일만 첨부할 수 있습니다.');
      }
      const rawSize = Number(item.size);
      const size = Number.isFinite(rawSize) && rawSize > 0
        ? Math.min(Math.floor(rawSize), 20 * 1024 * 1024)
        : 0;
      return {
        id: rowId(item.id),
        name: text(item.name, 200, '파일명'),
        path,
        size,
      };
    })
    .filter((attachment) => attachment.path);
}

export function parseResumeInput(value: unknown, userId: string): ParsedResumeInput {
  if (!isPlainObject(value)) throw new Error('이력서 형식이 올바르지 않습니다.');
  const photoPath = value.photoPath === null || value.photoPath === ''
    ? null
    : text(value.photoPath, 500, '사진 경로');
  if (photoPath && !isCanonicalResumePhotoPath(photoPath, userId)) {
    throw new Error('본인이 올린 이력서 사진만 사용할 수 있습니다.');
  }

  const email = text(value.email, 254, '이메일');
  if (email && !EMAIL_PATTERN.test(email)) throw new Error('이메일 형식이 올바르지 않습니다.');

  const phone = text(value.phone, 30, '연락처');
  if (phone && !isValidResumePhone(phone)) throw new Error('연락처 형식이 올바르지 않습니다.');

  const content: ResumeContent = {
    title: text(value.title, 80, '이력서 제목', true),
    photoPath,
    fullName: text(value.fullName, 80, '이름'),
    email,
    phone,
    birthDate: date(value.birthDate, '생년월일'),
    address: text(value.address, 200, '거주지'),
    headline: text(value.headline, 120, '한 줄 소개'),
    summary: text(value.summary, 5000, '자기소개'),
    desiredRoles: stringList(value.desiredRoles, '희망 직무', 10, 60),
    desiredRegions: stringList(value.desiredRegions, '희망 지역', 10, 40),
    desiredEmploymentTypes: stringList(value.desiredEmploymentTypes, '희망 고용형태', 10, 40),
    skills: stringList(value.skills, '기술/강점', 30, 50),
    educations: parseEducations(value.educations),
    experiences: parseExperiences(value.experiences),
    certificates: parseCertificates(value.certificates),
    languages: parseLanguages(value.languages),
    links: parseLinks(value.links),
    attachments: parseAttachments(value.attachments, userId),
  };

  return {
    content,
    isDefault: value.isDefault === true,
    completenessScore: calculateResumeCompleteness(content),
  };
}
