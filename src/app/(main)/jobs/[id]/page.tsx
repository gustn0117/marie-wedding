import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import type { Job } from '@/types/database';
import JobDescriptionView from '@/features/jobs/components/JobDescriptionView';
import JobDetailActions from '@/features/jobs/components/JobDetailActions';
import JobApplicationBox from '@/features/applications/components/JobApplicationBox';
import JobViewTracker from '@/features/jobs/components/JobViewTracker';
import JobDetailHero from '@/features/jobs/components/JobDetailHero';
import JobDetailSidebar from '@/features/jobs/components/JobDetailSidebar';
import JobMobileApplyBar from '@/features/jobs/components/JobMobileApplyBar';
import RelatedJobs from '@/features/jobs/components/RelatedJobs';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getJob(id: string): Promise<Job | null> {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('jobs')
    .select(`*, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS})`)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return data as Job | null;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const viewerResult = await getCurrentVerifiedProfile();
  const viewer = viewerResult.ok ? viewerResult : null;

  // 숨김 공고(관리자 숨김 / 작성자 숨김)는 목록·연관공고에서 걸러지지만 상세는 service_role 이라
  // RLS 가 없다. URL 직접 접근·북마크·인덱싱으로 노출되므로 작성자 본인/관리자만 열람 허용.
  if (job.hidden_by_admin || job.status === 'hidden') {
    const allowed =
      !!viewer &&
      (viewer.profileId === job.author_id || viewer.role === 'admin');
    if (!allowed) notFound();
  }

  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  // 마감(마감일 경과 또는 수동 closed/filled/hidden) — 지원 폼 대신 마감 안내를 노출
  const isClosed = isExpired || ['closed', 'filled', 'hidden'].includes(job.status);
  const isAuthorViewer = !!viewer && viewer.profileId === job.author_id;
  const isBusinessViewer = viewer?.accountType === 'business' && !isAuthorViewer;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 pb-24 lg:pb-8">
      <JobViewTracker jobId={job.id} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={ROUTES.JOBS} className="text-gray-500 hover:text-primary transition-colors">
          채용
        </Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{job.title}</span>
      </nav>

      {/* Main grid: content + sidebar */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 min-w-0">
          {/* Author actions (edit/delete for owner) — hero 상단 우측.
              SSR 에서 viewer 판정한 canManage 를 prop 으로 넘겨 flash 방지. */}
          <JobDetailActions
            jobId={job.id}
            authorId={job.author_id}
            initialCanManage={
              !!viewer && (viewer.profileId === job.author_id || viewer.role === 'admin')
            }
          />

          <JobDetailHero job={job} />

          {/* Description */}
          <section className="rounded-xl bg-white border border-gray-200 p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-5 pb-3 border-b border-gray-200">상세 내용</h2>
            <JobDescriptionView html={job.description} />
          </section>

          {/* Application box (anchor target) — 본문 직후 사용자의 다음 행동 */}
          <div id="apply" className="scroll-mt-20">
            <JobApplicationBox jobId={job.id} authorId={job.author_id} isClosed={isClosed} />
          </div>

          {/* Related jobs — 지원 결정 후 추가 탐색 */}
          <RelatedJobs authorId={job.author_id} currentJobId={job.id} />
        </div>

        {/* Sidebar */}
        <JobDetailSidebar job={job} blockReason={isBusinessViewer ? '업체 회원은 지원할 수 없어요' : null} />
      </div>

      {/* Mobile sticky apply bar */}
      <JobMobileApplyBar
        label="지원하기"
        disabled={isExpired || isBusinessViewer}
        blockReason={isBusinessViewer ? '업체 회원은 지원할 수 없어요' : null}
      />
    </div>
  );
}
