import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import {
  ADMIN_SESSION_COOKIE_NAME,
  verifyAdminSessionToken,
} from '@/lib/admin-session';

const ADMIN_AUTH_TIMEOUT_MS = 8_000;

/**
 * Admin 권한 판정 — 두 가지 경로 중 하나라도 통과하면 true.
 *   1) HMAC 서명·만료 검증을 통과한 관리자 세션 쿠키
 *   2) 로그인된 사용자의 profile.role === 'admin'
 *
 * 비밀번호는 오직 /api/admin/unlock 에서만 검증한다. 일반 관리자 API가 body의
 * password를 직접 받으면 그 API 자체가 무제한 비밀번호 판별기가 되기 때문이다.
 */
export async function isAdminRequest(callerSignal?: AbortSignal): Promise<boolean> {
  if (callerSignal?.aborted) return false;
  const cookieStore = await cookies();

  // 비밀번호 잠금 해제 쿠키
  if (verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value)) return true;

  const signal = callerSignal
    ? AbortSignal.any([callerSignal, AbortSignal.timeout(ADMIN_AUTH_TIMEOUT_MS)])
    : AbortSignal.timeout(ADMIN_AUTH_TIMEOUT_MS);

  // 로그인된 admin role
  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
        }),
      },
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
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

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || signal.aborted) return false;

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .abortSignal(signal)
      .maybeSingle();

    return !error && !signal.aborted && data?.role === 'admin';
  } catch {
    // 인증 인프라 장애/timeout은 권한 없음으로 닫는다(fail closed).
    return false;
  }
}
