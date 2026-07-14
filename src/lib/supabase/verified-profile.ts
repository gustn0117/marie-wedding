import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createServiceClient } from '@/lib/supabase/service';

export type VerifiedProfileResult =
  | {
      ok: true;
      userId: string;
      profileId: string;
      email: string | null;
      accountType: 'business' | 'individual';
      role: string;
    }
  | { ok: false; reason: 'unauthorized' | 'profile_not_found' | 'timeout' | 'server_error' };

/**
 * 서비스 역할 API에서 사용할 호출자 신원.
 *
 * `marie_profile`은 빠른 화면 표시용이며 브라우저가 수정할 수 있으므로 권한 판단에
 * 절대 사용하지 않는다. Supabase가 검증한 auth user를 profiles.user_id로 다시 매핑한다.
 */
export async function getVerifiedProfile(signal: AbortSignal): Promise<VerifiedProfileResult> {
  if (signal.aborted) return { ok: false, reason: 'timeout' };

  const cookieStore = await cookies();
  const authClient = createServerClient(
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
        getAll() { return cookieStore.getAll(); },
        setAll() { /* 이 헬퍼는 요청 신원 확인만 수행한다. */ },
      },
    },
  );

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (signal.aborted) return { ok: false, reason: 'timeout' };
    if (authError || !user) return { ok: false, reason: 'unauthorized' };

    const service = createServiceClient(signal);
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('id, account_type, role')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .abortSignal(signal)
      .maybeSingle();

    if (signal.aborted) return { ok: false, reason: 'timeout' };
    if (profileError) {
      console.error('[verified-profile] profile lookup failed:', profileError.message);
      return { ok: false, reason: 'server_error' };
    }
    if (!profile) return { ok: false, reason: 'profile_not_found' };
    return {
      ok: true,
      userId: user.id,
      profileId: profile.id,
      email: user.email ?? null,
      accountType: profile.account_type,
      role: profile.role,
    };
  } catch (error) {
    if (signal.aborted) return { ok: false, reason: 'timeout' };
    console.error('[verified-profile] auth lookup failed:', error);
    return { ok: false, reason: 'server_error' };
  }
}

/** 같은 Server Component 요청 안에서 layout/page의 세션 확인을 한 번만 수행한다. */
export const getCurrentVerifiedProfile = cache(
  () => getVerifiedProfile(AbortSignal.timeout(10_000)),
);
