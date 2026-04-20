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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href={ROUTES.JOBS}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      {/* Job Image */}
      {job.image && (
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${job.image}`}
            alt={job.title}
            className="w-full max-h-[400px] object-contain bg-gray-50"
          />
        </div>
      )}

      <article className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge-primary text-xs font-medium px-3 py-1 rounded-full">{getEmploymentTypeLabel(job.employment_type)}</span>
            <span className="badge-accent text-xs font-medium px-3 py-1 rounded-full">{getBusinessTypeLabel(job.business_type)}</span>
            {isExpired && <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-500">마감됨</span>}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{job.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium">{job.author?.company_name ?? '알 수 없음'}</span>
            <span className="text-gray-300">|</span>
            <span>{getRegionLabel(job.region)}</span>
            <span className="text-gray-300">|</span>
            <time>{formatRelativeTime(job.created_at)}</time>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <InfoItem label="업종" value={getBusinessTypeLabel(job.business_type)} />
            <InfoItem label="고용형태" value={getEmploymentTypeLabel(job.employment_type)} />
            <InfoItem label="지역" value={getRegionLabel(job.region)} />
            {job.salary_info && <InfoItem label="급여" value={job.salary_info} />}
            {job.deadline && <InfoItem label="마감일" value={formatDate(job.deadline)} highlight={isExpired} />}
            <InfoItem label="등록일" value={formatDate(job.created_at)} />
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">상세 내용</h2>
            <RichTextView html={job.description} className="text-sm text-gray-600 leading-relaxed" />
          </div>
        </div>

        {job.author && (
          <>
            <div className="border-t border-gray-100" />
            <div className="p-6 md:p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">업체 정보</h2>
              <div className="flex items-start gap-4">
                <ProfileAvatar profileImage={job.author.profile_image} name={job.author.company_name || job.author.contact_name} size="md" />
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{job.author.company_name}</p>
                  <p className="text-sm text-gray-500">{getRegionLabel(job.author.region)}</p>
                  {job.author.bio && <p className="text-sm text-gray-400 mt-2">{job.author.bio}</p>}
                </div>
              </div>
            </div>
          </>
        )}

        <JobDetailActions jobId={job.id} authorId={job.author_id} />
      </article>
    </div>
  );
}

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-red-500' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
