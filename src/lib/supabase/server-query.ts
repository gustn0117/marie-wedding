import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA } from './schema';

// Server-side Supabase client for data fetching (no cookies needed)
// Uses service_role to bypass RLS for read operations
//
// ⚠️ cache: 'no-store' 강제 —
// Next.js App Router 는 서버에서 실행되는 fetch() 응답을 Data Cache 에 저장한다.
// supabase-js 는 내부적으로 fetch 를 쓰는데, 페이지에 export const dynamic='force-dynamic'
// 를 걸어도 이 서드파티 fetch 까지 no-store 가 확실히 전파되지 않아, 빌드/최초 렌더 시점의
// 응답이 프로세스 메모리에 캐시된 채 유지되는 문제가 있었다.
// 게다가 클러스터(멀티워커) 배포라 워커마다 캐시 스냅샷이 달라 '삭제한 공고/비공개 프로필이
// 새로고침마다 떴다 사라졌다' 하는 깜빡임이 발생했다.
// → 읽기 클라이언트의 모든 요청에 cache:'no-store' 를 주입해 매 요청 실시간 조회를 보장한다.
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: 'no-store' });
}

export function createServerQueryClient() {
  return createClient(
    SUPABASE_SERVER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: SUPABASE_SCHEMA },
      global: { fetch: noStoreFetch },
    }
  );
}
