import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA } from './schema';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: SUPABASE_SCHEMA } },
  );
}
