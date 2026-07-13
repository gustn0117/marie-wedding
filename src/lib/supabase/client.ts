import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { SUPABASE_SCHEMA } from './schema';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: SUPABASE_SCHEMA },
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    }
  );
}
