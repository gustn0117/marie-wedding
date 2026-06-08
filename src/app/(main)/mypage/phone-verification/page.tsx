import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import PhoneVerificationForm from '@/features/verification/components/PhoneVerificationForm';

export const dynamic = 'force-dynamic';

export default async function PhoneVerificationPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, phone, phone_verified, phone_verified_at')
    .eq('id', me.id)
    .is('deleted_at', null)
    .single();

  if (!profile) redirect(ROUTES.MYPAGE);

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">본인 확인</span>
      </nav>

      <header className="platform-panel p-6">
        <p className="platform-eyebrow">신뢰</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">휴대폰 본인 확인</h1>
        <p className="mt-2 text-sm text-gray-600">
          본인 확인이 완료되면 카드와 프로필에 &quot;실명 확인&quot; 배지가 노출됩니다.
          업체 인증(사업자등록증)과는 별개입니다.
        </p>
      </header>

      <section className="platform-panel p-5 text-sm">
        <p className="font-bold text-gray-900 mb-2">
          현재 상태: {profile.phone_verified ? '본인 확인 완료' : '미확인'}
        </p>
        {profile.phone_verified && profile.phone_verified_at && (
          <p className="text-gray-600">{new Date(profile.phone_verified_at).toLocaleString('ko-KR')} 확인됨</p>
        )}
        {profile.phone && (
          <p className="text-gray-500 mt-1 font-mono text-xs">번호: {profile.phone}</p>
        )}
      </section>

      {!profile.phone_verified && (
        <section className="platform-panel p-6">
          <PhoneVerificationForm />
        </section>
      )}
    </main>
  );
}
