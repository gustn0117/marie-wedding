import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA } from './schema';

export function createServiceClient(signal?: AbortSignal) {
  return createClient(
    SUPABASE_SERVER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: SUPABASE_SCHEMA },
      ...(signal ? {
        global: {
          // 한 API 요청의 deadline을 Supabase REST/Auth/Storage fetch에도 전달한다.
          // SDK가 자체 signal을 주는 경우 둘 중 하나라도 취소되면 즉시 중단한다.
          fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
            ...init,
            signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
          }),
        },
      } : {}),
    },
  );
}
