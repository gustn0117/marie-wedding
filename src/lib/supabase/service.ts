import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA } from './schema';

export function createServiceClient() {
  return createClient(
    SUPABASE_SERVER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: SUPABASE_SCHEMA } },
  );
}
