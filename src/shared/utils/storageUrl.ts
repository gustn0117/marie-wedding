/**
 * Supabase Storage 경로/절대 URL/루트 경로를 안전하게 표시 가능한 URL로 변환.
 *
 * - http(s) 절대 URL → 그대로 반환 (외부 이미지, 데모 데이터 등)
 * - '/' 로 시작하는 경로 → 그대로 반환 (앱 내부 정적 자산)
 * - 그 외 → `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${value}` 조립
 *
 * 빈/undefined 입력은 null 반환.
 */
export function resolveStorageUrl(
  value: string | null | undefined,
  bucket: 'avatars' | 'job-images' | 'event-images' | 'portfolios',
): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${value}`;
}
