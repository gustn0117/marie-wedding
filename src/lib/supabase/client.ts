import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { SUPABASE_SCHEMA } from './schema';
import { fetchWithAbortSignals } from '@/shared/utils/abort';

export function createClient(signal?: AbortSignal) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 취소 신호를 캡처한 client를 브라우저 singleton으로 재사용하면 첫 작업의
      // timeout 이후 모든 Supabase 요청이 영구 abort된다.
      isSingleton: !signal,
      db: { schema: SUPABASE_SCHEMA },
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME, secure: process.env.NODE_ENV === 'production' },
      ...(signal ? {
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => (
            fetchWithAbortSignals(input, init, signal)
          ),
        },
      } : {}),
    }
  );
}
