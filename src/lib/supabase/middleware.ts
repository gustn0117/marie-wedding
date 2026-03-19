import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Skip auth check if Supabase is not configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')
  ) {
    return supabaseResponse;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup');
    const isPublicPage = request.nextUrl.pathname === '/';

    if (!user && !isAuthPage && !isPublicPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (user && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/jobs';
      return NextResponse.redirect(url);
    }
  } catch {
    // Supabase connection failed, allow request through
  }

  return supabaseResponse;
}
