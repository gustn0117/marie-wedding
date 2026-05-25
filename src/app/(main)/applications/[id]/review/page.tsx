import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import ReviewForm from '@/features/reviews/components/ReviewForm';
import type { Application, Job, Profile } from '@/types/database';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function ReviewPage({ params }: Props) {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const { data: appData } = await supabase
    .from('applications')
    .select('*, job:jobs(*, author:profiles!author_id(*)), applicant:profiles(*)')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!appData) notFound();
  const application = appData as Application & {
    job?: Job & { author?: Profile };
    applicant?: Profile;
  };

  const job = application.job!;
  const isHiring = me.id === job.author_id;
  const isApplicant = me.id === application.applicant_id;
  if (!isHiring && !isApplicant) redirect(ROUTES.MYPAGE);

  if (!application.hiring_completed_at || !application.applicant_completed_at) {
    return (
      <main className="mx-auto max-w-2xl space-y-4">
        <header className="platform-panel p-6">
          <h1 className="text-2xl font-bold text-gray-900">리뷰 작성</h1>
          <p className="mt-2 text-sm text-gray-600">양쪽 모두 거래 완료 표시를 해야 리뷰를 작성할 수 있습니다.</p>
        </header>
      </main>
    );
  }

  // 본인이 이미 작성한 리뷰가 있는지 확인
  const direction = isHiring ? 'hiring_to_applicant' : 'applicant_to_hiring';
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('application_id', application.id)
    .eq('direction', direction)
    .is('deleted_at', null)
    .maybeSingle();

  const reviewee = isHiring ? application.applicant : job.author;
  const revieweeName = reviewee?.company_name || reviewee?.contact_name || '거래 상대';
  const appliesTo: 'hiring' | 'applicant' = isHiring ? 'applicant' : 'hiring';

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">리뷰 작성</span>
      </nav>

      <header className="platform-panel p-6">
        <p className="platform-eyebrow">Review</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{revieweeName} 리뷰</h1>
        <p className="mt-2 text-sm text-gray-600 truncate">{job.title}</p>
      </header>

      <section className="platform-panel p-6">
        {existing ? (
          <div className="text-sm">
            <p className="font-bold text-gray-900 mb-2">이미 리뷰를 작성하셨습니다.</p>
            <p className="text-gray-600">리뷰는 작성 후 수정할 수 없습니다. 잘못된 내용이 있다면 신고 기능을 이용해 주세요.</p>
          </div>
        ) : (
          <ReviewForm applicationId={application.id} appliesTo={appliesTo} />
        )}
      </section>
    </main>
  );
}
