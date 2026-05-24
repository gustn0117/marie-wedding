import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

function isValidPassword(password?: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  return !!configured && !!password && password === configured;
}

export async function isAdminRequest(password?: string): Promise<boolean> {
  if (isValidPassword(password)) return true;

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Admin API auth only needs to read the request cookies.
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const serviceClient = createServiceClient();
  const { data } = await serviceClient
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  return data?.role === 'admin';
}
