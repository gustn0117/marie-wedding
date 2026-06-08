import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import VerificationForm from '@/features/verification/components/VerificationForm';
import { VERIFICATION_STATUS_LABELS, ROUTES } from '@/shared/constants';
import type { VerificationStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function VerificationPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let cookieProfile: { id: string } | null = null;
  try { cookieProfile = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!cookieProfile?.id) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, account_type, verification_status, verification_submitted_at, verification_reviewed_at, verification_reject_reason, business_number, verified_at')
    .eq('id', cookieProfile.id)
    .is('deleted_at', null)
    .single();

  if (!profile) redirect(ROUTES.MYPAGE);

  if (profile.account_type !== 'business') {
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
          <span className="mx-2 text-gray-300">›</span>
          <span className="text-gray-900 font-medium">업체 인증</span>
        </nav>
        <div className="platform-panel p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">업체 인증</h1>
          <p className="text-sm text-gray-700">
            개인 계정은 업체 인증 대상이 아닙니다. 추후 휴대폰 본인인증 기능이 추가될 예정입니다.
          </p>
        </div>
      </main>
    );
  }

  const status = profile.verification_status as VerificationStatus;
  const showForm = status === 'unverified' || status === 'rejected';

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">업체 인증</span>
      </nav>

      <header className="platform-panel p-6">
        <p className="platform-eyebrow">신뢰</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">업체 인증</h1>
        <p className="mt-2 text-sm text-gray-600">
          사업자등록증을 제출하면 관리자 검토 후 프로필·카드에 &quot;인증&quot; 배지가 노출됩니다.
        </p>
      </header>

      <section className="platform-panel p-5 text-sm">
        <p className="font-bold text-gray-900 mb-2">현재 상태: {VERIFICATION_STATUS_LABELS[status]}</p>
        {status === 'verified' && profile.verified_at && (
          <p className="text-gray-600">{new Date(profile.verified_at).toLocaleString('ko-KR')} 승인됨</p>
        )}
        {status === 'pending' && profile.verification_submitted_at && (
          <p className="text-gray-600">
            {new Date(profile.verification_submitted_at).toLocaleString('ko-KR')} 제출. 검토에는 영업일 기준 1~3일이 소요됩니다.
          </p>
        )}
        {status === 'rejected' && profile.verification_reject_reason && (
          <p className="text-gray-700">사유: {profile.verification_reject_reason}</p>
        )}
        {profile.business_number && (
          <p className="text-gray-500 mt-1 font-mono text-xs">사업자번호: {profile.business_number}</p>
        )}
      </section>

      {showForm && (
        <section className="platform-panel p-6">
          <VerificationForm />
        </section>
      )}
    </main>
  );
}
