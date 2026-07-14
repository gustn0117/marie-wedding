import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';

const VERIFICATION_BUCKET = 'verifications';

/** DB 참조가 교체/삭제된 뒤 민감한 인증 서류 객체를 best-effort로 제거한다. */
export async function removeVerificationDocument(path: string | null | undefined): Promise<boolean> {
  if (!path) return true;
  const signal = AbortSignal.timeout(5_000);
  const storage = createClient(SUPABASE_SERVER_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal }),
    },
  });
  try {
    const { error } = await storage.storage.from(VERIFICATION_BUCKET).remove([path]);
    if (error) {
      console.error('[verification-document] cleanup failed:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[verification-document] cleanup request failed:', error);
    return false;
  }
}
