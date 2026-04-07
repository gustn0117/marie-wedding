import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import JobNewSubmit from '@/features/jobs/components/JobNewSubmit';

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');

  if (!profileCookie?.value) {
    redirect(ROUTES.LOGIN);
  }

  let profile: { id: string; account_type: string } | null = null;
  try {
    profile = JSON.parse(profileCookie.value);
  } catch {
    redirect(ROUTES.LOGIN);
  }

  if (!profile?.id) redirect(ROUTES.LOGIN);

  if (profile.account_type === 'individual') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">업체 회원 전용 기능입니다</h2>
          <p className="text-sm text-gray-500">공고 등록은 업체 회원만 가능합니다.</p>
          <Link href={ROUTES.JOBS} className="btn-primary text-sm px-6 py-2.5 inline-block">목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.JOBS} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">공고 등록</h1>
      </div>

      <JobNewSubmit profileId={profile.id} />
    </div>
  );
}
