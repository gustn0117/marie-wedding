/**
 * 공개 경로에서 쓰는 jobs 컬럼 목록.
 *
 * select('*') 를 쓰면 대행 공고의 claim_code(업체가 공고를 가져가는 비밀 코드)와
 * 담당자 연락처·동의 기록까지 RSC 페이로드에 실려 공개 HTML 로 나간다.
 * 실제로 홈 화면에서 claim_code 가 새어나가던 것을 확인해 화이트리스트로 바꿨다.
 *
 * 리터럴 문자열로 둔다 — 배열 join 으로 만들면 supabase-js 가 결과 타입을 추론하지 못한다.
 */
export const PUBLIC_JOB_COLUMNS =
  'id, author_id, posting_type, title, description, business_type, employment_type, region, '
  + 'salary_info, salary_min, salary_max, salary_unit, experience_min, '
  + 'is_urgent, deadline, image, images, proxy_company_name, '
  + 'view_count, hidden_by_admin, is_promoted, promoted_until, featured_at, featured_order, status, '
  + 'created_at, updated_at, deleted_at';
