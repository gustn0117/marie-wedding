import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA } from './schema';

// Server-side Supabase client for data fetching (no cookies needed)
// Uses service_role to bypass RLS for read operations
export function createServerQueryClient() {
  return createClient(
    SUPABASE_SERVER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: SUPABASE_SCHEMA } }
  );
}
