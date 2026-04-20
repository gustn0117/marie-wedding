import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import {
  formatDate,
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import type { Job } from '@/types/database';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import RichTextView from '@/shared/components/RichTextView';
import JobDetailActions from '@/features/jobs/components/JobDetailActions';

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
  const daysLeft = job.deadline
    ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={ROUTES.JOBS} className="text-gray-500 hover:text-primary transition-colors">
          {job.posting_type === 'matching' ? '업체 섭외' : '채용'}
        </Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{job.title}</span>
      </nav>

      {/* Header Card */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        {/* Image */}
        {job.image && (
          <div className="border-b border-gray-200">
            <img
              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${job.image}`}
              alt={job.title}
              className="w-full max-h-[360px] object-contain bg-gray-50"
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="inline-flex items-center px-2.5 py-1 bg-primary text-white text-xs font-semibold">
              {job.posting_type === 'matching' ? '업체 섭외' : '채용'}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 bg-primary-50 text-primary text-xs font-semibold">
              {getBusinessTypeLabel(job.business_type)}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold">
              {getEmploymentTypeLabel(job.employment_type)}
            </span>
            {isExpired ? (
              <span className="inline-flex items-center px-2.5 py-1 bg-gray-200 text-gray-500 text-xs font-semibold">
                마감됨
              </span>
            ) : daysLeft !== null && daysLeft <= 7 ? (
              <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-600 text-xs font-semibold">
                마감 {daysLeft}일 전
              </span>
            ) : null}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-4">
            {job.title}
          </h1>

          {/* Company + Meta */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <ProfileAvatar
              profileImage={job.author?.profile_image}
              name={job.author?.company_name || job.author?.contact_name || '?'}
              size="sm"
              className="!rounded-lg"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {job.author?.company_name || job.author?.contact_name || '알 수 없음'}
              </p>
              <p className="text-xs text-gray-400">
                <time>{formatRelativeTime(job.created_at)}</time> 등록
              </p>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-b border-gray-100 -mx-6 md:-mx-8 mt-4 mb-6">
            <QuickInfo label="근무지역" value={getRegionLabel(job.region)} />
            <QuickInfo label="고용형태" value={getEmploymentTypeLabel(job.employment_type)} />
            <QuickInfo label="급여" value={job.salary_info || '면접 후 결정'} />
            <QuickInfo
              label="마감일"
              value={job.deadline ? formatDate(job.deadline) : '상시 채용'}
              highlight={isExpired}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white border border-gray-200 p-6 md:p-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">상세 내용</h2>
        <RichTextView html={job.description} className="text-[15px] text-gray-700 leading-relaxed" />
      </div>

      {/* Company Card */}
      {job.author && (
        <div className="bg-white border border-gray-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">업체 정보</h2>
          <Link
            href={ROUTES.DIRECTORY_DETAIL(job.author.id)}
            className="flex items-start gap-4 group"
          >
            <ProfileAvatar
              profileImage={job.author.profile_image}
              name={job.author.company_name || job.author.contact_name}
              size="lg"
              className="!rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-base font-bold text-gray-900 group-hover:text-primary transition-colors truncate">
                  {job.author.company_name || job.author.contact_name}
                </p>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                {job.author.business_type && <span>{getBusinessTypeLabel(job.author.business_type)}</span>}
                {job.author.business_type && <span>·</span>}
                <span>{getRegionLabel(job.author.region)}</span>
              </div>
              {job.author.bio && (
                <p className="text-sm text-gray-500 line-clamp-2">
                  {job.author.bio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                </p>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Author Actions */}
      <JobDetailActions jobId={job.id} authorId={job.author_id} />

      {/* Back to list */}
      <div className="flex justify-center pt-4">
        <Link
          href={ROUTES.JOBS}
          className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

function QuickInfo({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="px-6 py-4 border-r border-gray-100 last:border-r-0 even:border-r-0 sm:even:border-r sm:last:border-r-0 last-of-type:border-r-0">
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-red-500' : 'text-gray-900'} truncate`}>{value}</p>
    </div>
  );
}
