import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 네이버 이메일 동의 거부 시 진입.
 * v1에서는 임시 안내만 노출하고 사용자가 이메일을 직접 등록할 수 있는 흐름(/mypage/edit)으로 안내.
 * 추후 OTP 인증 + email update API 추가 예정 (v2).
 */
export default async function EmailRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || '/jobs';

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

  return (
    <div className="mx-auto max-w-lg px-5 py-10 sm:py-16">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-semibold text-amber-700 mb-1">이메일 정보가 필요해요</p>
        <h1 className="text-lg font-bold text-ink">네이버에서 이메일 동의를 받지 못했어요</h1>
        <p className="mt-2 text-sm text-amber-900/80">
          공고 지원·등록 시 연락에 사용되는 이메일이 필요합니다.
          아래 단계로 이메일을 등록해주세요.
        </p>
        <ol className="mt-3 space-y-1.5 text-sm text-amber-900/90 list-decimal pl-5">
          <li>먼저 짧은 온보딩을 완료해주세요.</li>
          <li>그다음 마이페이지 &gt; 프로필 수정에서 이메일을 등록할 수 있어요.</li>
        </ol>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Link
          href={`/onboarding?next=${encodeURIComponent(next)}`}
          className="block h-12 leading-[3rem] text-center rounded-lg bg-ink text-white text-sm font-bold"
        >
          온보딩 계속하기
        </Link>
        <Link
          href={ROUTES.LOGIN}
          className="block h-12 leading-[3rem] text-center rounded-lg border border-gray-200 text-sm text-gray-700"
        >
          다른 방법으로 다시 로그인
        </Link>
      </div>
    </div>
  );
}
