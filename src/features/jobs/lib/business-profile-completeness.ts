import type { Profile } from '@/types/database';

/**
 * 공고 등록을 허용하기 위한 업체 프로필 완성도 검증.
 *
 * 필수 필드:
 *  - company_name : 업체명 (지원자가 보는 1차 정보)
 *  - business_type: 업종 (검색·매칭 기반)
 *  - region       : 활동 지역 (지역 필터링)
 *  - phone        : 연락처 (채용 진행 시 즉시 연락)
 *
 * bio(회사 소개) 는 권장이지만 필수가 아님.
 */
export const REQUIRED_BUSINESS_FIELDS = [
  { key: 'company_name', label: '업체명', hint: '예: 마리에 웨딩홀' },
  { key: 'business_type', label: '업종', hint: '예식장 / 드레스 / 스튜디오 등' },
  { key: 'region', label: '활동 지역', hint: '서울 / 경기 등' },
  { key: 'phone', label: '연락처', hint: '010-XXXX-XXXX' },
] as const;

export interface CompletenessResult {
  isComplete: boolean;
  missing: Array<{ key: string; label: string; hint: string }>;
  filled: number;
  total: number;
}

export function checkBusinessProfileCompleteness(
  profile: Pick<Profile, 'company_name' | 'business_type' | 'region' | 'phone' | 'bio'>,
): CompletenessResult {
  const missing: Array<{ key: string; label: string; hint: string }> = [];

  if (!profile.company_name?.trim()) {
    missing.push({ key: 'company_name', label: '업체명', hint: '예: 마리에 웨딩홀' });
  }
  if (!profile.business_type?.trim()) {
    missing.push({ key: 'business_type', label: '업종', hint: '예식장 / 드레스 / 스튜디오 등' });
  }
  if (!profile.region?.trim()) {
    missing.push({ key: 'region', label: '활동 지역', hint: '서울 / 경기 등' });
  }
  if (!profile.phone?.trim() || profile.phone.replace(/[^0-9]/g, '').length < 9) {
    missing.push({ key: 'phone', label: '연락처', hint: '010-XXXX-XXXX' });
  }

  const total = REQUIRED_BUSINESS_FIELDS.length;
  return {
    isComplete: missing.length === 0,
    missing,
    filled: total - missing.length,
    total,
  };
}
