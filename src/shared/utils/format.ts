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
  const found = BUSINESS_TYPES.find((item) => item.value === type);
  return found?.label ?? type;
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
 */
export function getRegionLabel(type: string): string {
  const found = REGIONS.find((item) => item.value === type);
  return found?.label ?? type;
}

/**
 * Convert a post category enum value to its Korean label.
 */
export function getCategoryLabel(type: string): string {
  const found = POST_CATEGORIES.find((item) => item.value === type);
  return found?.label ?? type;
}
