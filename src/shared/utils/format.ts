import { REGION_DETAILS } from '@/shared/constants/regions';
import {
  BUSINESS_TYPES,
  EMPLOYMENT_TYPES,
  REGIONS,
  POST_CATEGORIES,
} from '@/shared/constants';

/**
 * Format a date string to Korean format: "2024.03.15"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

/**
 * Format a date string to a relative time in Korean.
 * e.g. "방금 전", "5분 전", "2시간 전", "3일 전", "2주 전", "1달 전"
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return '방금 전';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}주 전`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}달 전`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}년 전`;
}

/**
 * Convert a business type enum value to its Korean label.
 */
export function getBusinessTypeLabel(type: string): string {
  if (type.includes(',')) {
    return type.split(',').map(t => {
      const found = BUSINESS_TYPES.find((item) => item.value === t.trim());
      return found?.label ?? t.trim();
    }).join(', ');
  }
  const found = BUSINESS_TYPES.find((item) => item.value === type);
  return found?.label ?? type;
}

/**
 * CSV로 저장된 다중 업종을 라벨 배열로. 빈 값/중복 제거.
 */
export function getBusinessTypeLabels(csv: string | null | undefined): string[] {
  if (!csv) return [];
  const seen = new Set<string>();
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && !seen.has(t) && (seen.add(t) || true))
    .map((t) => BUSINESS_TYPES.find((item) => item.value === t)?.label ?? t);
}

/**
 * CSV의 첫 N개 라벨 + 나머지 "외 K개" 형식. 한 줄 메타 표시에 적합.
 */
export function getPrimaryBusinessTypeLabel(csv: string | null | undefined, max: number = 1): string {
  const labels = getBusinessTypeLabels(csv);
  if (labels.length === 0) return '';
  if (labels.length <= max) return labels.join(', ');
  return `${labels.slice(0, max).join(', ')} 외 ${labels.length - max}`;
}

/**
 * Convert an employment type enum value to its Korean label.
 */
export function getEmploymentTypeLabel(type: string): string {
  const found = EMPLOYMENT_TYPES.find((item) => item.value === type);
  return found?.label ?? type;
}

/**
 * Convert a region enum value to its Korean label.
 * Supports sub-region values from REGION_DETAILS (e.g. 'yeongdo' → '부산 영도구').
 */
function findRegionLabel(value: string): string {
  const region = REGIONS.find((item) => item.value === value);
  if (region) return region.label;
  for (const parentKey of Object.keys(REGION_DETAILS)) {
    const details = REGION_DETAILS[parentKey];
    const detail = details.find((d) => d.value === value);
    if (detail) {
      const parent = REGIONS.find((r) => r.value === parentKey);
      return parent ? `${parent.label} ${detail.label}` : detail.label;
    }
  }
  return value;
}

export function getRegionLabel(type: string | null | undefined): string {
  if (!type) return '';
  if (type.includes(',')) {
    return type.split(',').map(r => findRegionLabel(r.trim())).join(', ');
  }
  return findRegionLabel(type);
}

/**
 * Convert a post category enum value to its Korean label.
 */
export function getCategoryLabel(type: string): string {
  const found = POST_CATEGORIES.find((item) => item.value === type);
  return found?.label ?? type;
}

/**
 * 한국 전화번호를 하이픈 형식으로 표시. (예: 01033192509 → 010-3319-2509)
 * 형식을 못 맞추면 원본 반환.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = raw.replace(/[^0-9]/g, '');
  if (d.startsWith('02')) {
    if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    if (d.length === 10) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}
