import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';
import Breadcrumb from '@/shared/components/Breadcrumb';
import ResumeManager from '@/features/resumes/components/ResumeManager';
import { mapResumeRow, RESUME_SELECT_COLUMNS } from '@/features/resumes/lib/mapper';

export const dynamic = 'force-dynamic';

export default async function ResumesPage() {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);
  if (viewer.accountType !== 'individual') redirect(ROUTES.MYPAGE);
  if (!viewer.onboardedAt) redirect('/onboarding');
  if (viewer.bannedAt) redirect('/banned');

  const signal = AbortSignal.timeout(10_000);
  const { data, error } = await createServiceClient(signal)
    .from('resumes')
    .select(RESUME_SELECT_COLUMNS)
    .eq('profile_id', viewer.profileId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .abortSignal(signal);
  if (error) {
    console.error('[resumes-page] list failed:', error.message);
    return (
      <main className="min-w-0">
        <PageHeader
          eyebrow="Career"
          title="이력서 관리"
          description="여러 이력서를 준비하고 공고에 맞는 제출본을 선택하세요."
          breadcrumb={<Breadcrumb items={[{ label: '마이페이지', href: ROUTES.MYPAGE }, { label: '이력서 관리' }]} />}
        />
        <section className="rounded border border-rose-200 bg-white px-6 py-12 text-center">
          <p className="font-bold text-gray-900">이력서를 불러오지 못했습니다.</p>
          <p className="mt-2 text-sm text-gray-500">잠시 후 다시 시도해주세요.</p>
          <Link href={ROUTES.MYPAGE_RESUMES} className="btn-primary mt-5 inline-flex">다시 시도</Link>
        </section>
      </main>
    );
  }
  const resumes = (data ?? []).map((row) => mapResumeRow(row as unknown as Record<string, unknown>));

  return (
    <main className="min-w-0">
      <PageHeader
        eyebrow="Career"
        title="이력서 관리"
        description="여러 이력서를 준비하고 공고에 맞는 제출본을 선택하세요. 지원 후에는 제출 당시 내용이 안전하게 보존됩니다."
        breadcrumb={<Breadcrumb items={[{ label: '마이페이지', href: ROUTES.MYPAGE }, { label: '이력서 관리' }]} />}
      />
      <ResumeManager initialResumes={resumes} userId={viewer.userId} />
    </main>
  );
}
