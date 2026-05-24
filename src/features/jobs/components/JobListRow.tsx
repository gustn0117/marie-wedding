import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { getDDayLabel, isUrgent, isNew, getJobTier } from '@/shared/utils/tier';
import Badge from '@/shared/components/Badge';
import ProfileAvatar from '@/shared/components/ProfileAvatar';

interface Props {
  job: Job;
}

export default function JobListRow({ job }: Props) {
  const tier = getJobTier(job);
  const dDay = getDDayLabel(job.deadline);
  const urgent = isUrgent(job.deadline);
  const fresh = isNew(job.created_at);

  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className={`list-row group ${tier === 2 ? 'bg-primary-50/40' : ''}`}
    >
      {/* Thumbnail */}
      {job.image ? (
        <div className="w-10 h-10 rounded-sm overflow-hidden bg-gray-100 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${job.image}`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <ProfileAvatar
          profileImage={job.author?.profile_image}
          name={job.author?.company_name || job.author?.contact_name || '업체'}
          size="sm"
          className="!rounded-sm"
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          {urgent && <Badge kind="urgent">마감임박</Badge>}
          {fresh && !urgent && <Badge kind="new">NEW</Badge>}
          <h3 className="text-body-lg font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
            {job.title}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small text-gray-500">
          <span className="font-medium text-gray-700 truncate max-w-[140px] sm:max-w-none">
            {job.author?.company_name ?? '알 수 없음'}
          </span>
          <span className="text-gray-300">·</span>
          <span>{job.author?.region ? getRegionLabel(job.author.region) : ''}</span>
          <span className="text-gray-300">·</span>
          <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
          <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
        </div>
        {job.salary_info && (
          <p className="text-small text-gray-500 mt-0.5">
            <span className="text-text-muted">급여</span>{' '}
            <span className="font-medium text-text-primary">{job.salary_info}</span>
          </p>
        )}
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-micro text-gray-400">
        <time>{formatRelativeTime(job.created_at)}</time>
        {dDay && (
          <span className={`font-semibold ${urgent ? 'text-state-urgent' : 'text-primary'}`}>
            {dDay}
          </span>
        )}
      </div>
    </Link>
  );
}
