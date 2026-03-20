import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client for data fetching (no cookies needed)
// Uses service_role to bypass RLS for read operations
export function createServerQueryClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'marie_wedding' } }
  );
}
