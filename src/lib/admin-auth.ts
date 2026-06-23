import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

function isValidPassword(password?: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  return !!configured && !!password && password === configured;
}

/**
 * Admin 권한 판정 — 세 가지 경로 중 하나라도 통과하면 true.
 *   1) request body의 password 가 ADMIN_PASSWORD와 일치
 *   2) marie_admin_unlock 쿠키 = '1' (브라우저에서 비밀번호 게이트 통과한 상태)
 *   3) 로그인된 사용자의 profile.role === 'admin'
 */
export async function isAdminRequest(password?: string): Promise<boolean> {
  if (isValidPassword(password)) return true;

  const cookieStore = await cookies();

  // 비밀번호 잠금 해제 쿠키
  if (cookieStore.get('marie_admin_unlock')?.value === '1') return true;

  // 로그인된 admin role
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Admin API auth only needs to read the request cookies.
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const serviceClient = createServiceClient();
  const { data } = await serviceClient
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  return data?.role === 'admin';
}
