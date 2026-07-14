/**
 * 누구나 볼 수 있는 프로필 열만 모은 목록.
 *
 * 전화번호·user_id·소셜 식별자·사업자번호·인증서·제재·관리 메모는 포함하지
 * 않는다. 자기 비공개 정보는 검증된 `/api/profile/me` 경로로만 읽는다.
 */
export const PUBLIC_PROFILE_COLUMNS =
  'id, account_type, business_type, company_name, contact_name, region, bio, website, profile_image, cover_image, is_directory_listed, company_size, established_year, address, gallery, created_at, updated_at, deleted_at, verification_status, verified_at, phone_verified, response_rate, avg_response_minutes, completed_deals_count, premium_tier, featured_at, featured_order' as const;

/** 검증된 본인 화면에 전달해도 되는 프로필 열. 관리자 메모·서류 경로는 제외한다. */
export const SELF_PROFILE_COLUMNS =
  'id, user_id, account_type, business_type, company_name, contact_name, region, signup_provider, onboarded_at, bio, phone, website, profile_image, cover_image, is_directory_listed, company_size, established_year, address, gallery, role, created_at, updated_at, deleted_at, verification_status, verification_submitted_at, verification_reviewed_at, verification_reject_reason, business_number, verified_at, phone_verified, phone_verified_at, response_rate, avg_response_minutes, completed_deals_count, premium_tier, premium_until, banned_at, banned_reason' as const;
