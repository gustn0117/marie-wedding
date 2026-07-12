import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_SCHEMA } from './schema';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: SUPABASE_SCHEMA },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component can't set cookies
          }
        },
      },
    }
  );
}
