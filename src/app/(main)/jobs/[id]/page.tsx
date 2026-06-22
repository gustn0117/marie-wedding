import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
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

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getJob(id: string): Promise<Job | null> {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('jobs')
    .select('*, author:profiles!author_id(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return data as Job | null;
}

export default async function JobDetailPage({ params }: PageProps) {
  const job = await getJob(params.id);
  if (!job) notFound();

  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;

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
          {/* Author actions (edit/delete for owner) — hero 상단 우측 */}
          <JobDetailActions jobId={job.id} authorId={job.author_id} />

          <JobDetailHero job={job} />

          {/* Description */}
          <section className="rounded-xl bg-white border border-gray-200 p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-5 pb-3 border-b border-gray-200">상세 내용</h2>
            <JobDescriptionView html={job.description} />
          </section>

          {/* Related jobs */}
          <RelatedJobs authorId={job.author_id} currentJobId={job.id} />

          {/* Application box (anchor target) */}
          <div id="apply" className="scroll-mt-20">
            <JobApplicationBox jobId={job.id} authorId={job.author_id} />
          </div>
        </div>

        {/* Sidebar */}
        <JobDetailSidebar job={job} />
      </div>

      {/* Mobile sticky apply bar */}
      <JobMobileApplyBar label="지원하기" disabled={isExpired} />
    </div>
  );
}
