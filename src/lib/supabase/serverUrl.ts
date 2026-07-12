/**
 * 서버사이드 Supabase 호출 전용 URL.
 *
 * 문제: 앱 컨테이너가 같은 호스트의 Supabase(Kong) 를 공인 URL(https://api.hsweb.pics)로
 * 호출하면 요청이 Cloudflare 터널을 타고 인터넷을 왕복(hairpin)함.
 *  - 요청당 +300ms 이상 상시 지연 (미들웨어는 페이지당 2회, 저장 API 는 4회 왕복)
 *  - cloudflared 불안정 시 fetch 가 settle 되지 않고 hang → 사용자에겐 '무한 로딩'
 *
 * 해결: 서버 내부에서는 SUPABASE_INTERNAL_URL(docker 내부 주소, 예: http://kong:8000)로
 * 직결. 브라우저가 쓰는 NEXT_PUBLIC_SUPABASE_URL 은 그대로 공인 URL 유지.
 * (스토리지 public object URL 은 브라우저가 로드하므로 항상 NEXT_PUBLIC 사용)
 */
export const SUPABASE_SERVER_URL =
  process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
