import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES, BUSINESS_TYPES, EMPLOYMENT_TYPES } from '@/shared/constants';
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
import JsonLd from '@/shared/components/JsonLd';
import { buildJobPostingJsonLd } from '@/features/jobs/lib/jobJsonLd';
import { toPlainText, breadcrumbJsonLd, SITE_NAME } from '@/shared/seo';
import { getRegionLabel } from '@/shared/utils/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

// generateMetadata 와 페이지 본문이 같은 요청에서 두 번 쿼리하지 않도록 캐시.
const getJob = cache(async (id: string): Promise<Job | null> => {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('jobs')
    .select(`*, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS})`)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return data as Job | null;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);
  if (!job || job.hidden_by_admin || job.status === 'hidden') {
    return { title: '채용 공고', robots: { index: false, follow: true } };
  }
  const org = job.author?.company_name || job.author?.contact_name || '';
  const region = job.region && job.region !== 'all' ? getRegionLabel(job.region) : '';
  const biz = BUSINESS_TYPES.find((b) => b.value === job.business_type)?.label || '';
  const emp = EMPLOYMENT_TYPES.find((e) => e.value === job.employment_type)?.label || '';
  const title = org ? `${job.title} - ${org}` : job.title;
  const facets = [region, biz, emp, job.salary_info].filter(Boolean).join(' · ');
  const body = toPlainText(job.description, 120);
  const description = [facets, body].filter(Boolean).join(' · ').slice(0, 160)
    || `${SITE_NAME} 웨딩 업계 채용 공고`;
  const canonical = `/jobs/${job.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'article', title, description, url: canonical },
    twitter: { title, description },
  };
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

  const isPubliclyVisible = !job.hidden_by_admin && job.status !== 'hidden';
  // 마감/충원/마감일 경과 공고는 JobPosting 마크업을 내지 않는다(구글 채용 정책:
  // 지원 불가 공고에 열린 것처럼 보이는 구조화데이터를 노출하면 제재 대상). 페이지 자체는 유지.
  const emitJobPosting = isPubliclyVisible && !isClosed;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 pb-24 lg:pb-8">
      {emitJobPosting && <JsonLd data={buildJobPostingJsonLd(job)} />}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '채용정보', path: '/jobs' },
          { name: job.title, path: `/jobs/${job.id}` },
        ])}
      />
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
