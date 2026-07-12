import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/service';
import OnboardingForm from '@/features/onboarding/components/OnboardingForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nextRaw = params.next;
  const next = sanitizeReturnTo(nextRaw) ?? '/jobs';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, contact_name, account_type, onboarded_at, signup_provider')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.onboarded_at) {
    redirect(next);
  }

  const initialName = profile?.contact_name || user.user_metadata?.name || '';

  return (
    <div className="mx-auto max-w-lg px-5 py-10 sm:py-16">
      <header className="mb-8">
        <p className="text-xs font-semibold text-primary mb-2">1단계 / 약 30초</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">
          환영합니다{initialName ? `, ${initialName}님` : ''}!
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          맞춤 공고를 보여드릴 수 있도록 짧은 정보 몇 가지만 받을게요.
        </p>
      </header>

      <OnboardingForm
        initialName={initialName}
        next={next}
        userId={user.id}
      />

      <p className="mt-6 text-center text-xs text-gray-400">
        나중에 마이페이지에서 모두 변경할 수 있어요.
      </p>
    </div>
  );
}

function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  // Reject backslashes: a browser normalizes `/\evil.com` (or its encoded
  // form `%2F%5Cevil.com`, decoded by Next.js searchParams) to the absolute
  // URL `https://evil.com/`, enabling open redirect on the origin-less
  // `redirect(next)` / `router.replace(next)` paths. This is load-bearing.
  if (value.includes('\\')) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  // Belt-and-suspenders for any protocol-relative style separator (// or /\).
  if (/^\/[\\/]/.test(value)) return null;
  if (value.includes('://')) return null;
  return value;
}
