import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

/**
 * Supabase native OAuth (Kakao/Google/Apple) callback.
 *
 * 신규 사용자: profile row를 onboarded_at=null 상태로 생성하고 /onboarding으로 강제.
 * 기존 사용자: onboarded_at 여부에 따라 /onboarding 또는 next 경로로.
 *
 * 동일 이메일 충돌은 Supabase가 자체 처리 (exchangeCodeForSession 에러 → /login?error=conflict).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next');
  const next = sanitizeReturnTo(requestedNext) ?? '/jobs';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // 동일 이메일이 이미 다른 provider로 등록된 경우 등 — provider 노출 없이 generic
    return NextResponse.redirect(`${origin}/login?error=conflict`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const serviceClient = createServiceClient();

  const { data: existingProfile } = await serviceClient
    .from('profiles')
    .select('id, onboarded_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username ||
      user.email?.split('@')[0] ||
      '사용자';

    const provider =
      (user.app_metadata?.provider as string | undefined) ||
      user.identities?.[0]?.provider ||
      'email';

    await serviceClient.from('profiles').insert({
      user_id: user.id,
      contact_name: name,
      account_type: null,
      region: null,
      signup_provider: provider,
      onboarded_at: null,
    });

    return NextResponse.redirect(
      `${origin}/onboarding?next=${encodeURIComponent(next)}`
    );
  }

  if (!existingProfile.onboarded_at) {
    return NextResponse.redirect(
      `${origin}/onboarding?next=${encodeURIComponent(next)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}
