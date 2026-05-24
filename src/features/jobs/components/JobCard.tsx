import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { getJobTier, isUrgent, isNew, getDDayLabel } from '@/shared/utils/tier';
import Badge from '@/shared/components/Badge';

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job }: JobCardProps) {
  const companyName = job.author?.company_name ?? '알 수 없음';
  const region = job.author?.region ? getRegionLabel(job.author.region) : '';
  const tier = getJobTier(job);
  const tierClass = tier === 2 ? 'card-tier-2' : '';
  const dDay = getDDayLabel(job.deadline);
  const urgent = isUrgent(job.deadline);
  const fresh = isNew(job.created_at);

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="block group">
      <article className={`card ${tierClass} h-full flex flex-col gap-2 group-hover:border-primary`}>
        {/* Status badges */}
        <div className="flex items-center gap-1 flex-wrap min-h-[18px]">
          {urgent && <Badge kind="urgent">마감임박</Badge>}
          {fresh && !urgent && <Badge kind="new">NEW</Badge>}
          <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
          <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
        </div>

        <h3 className="text-h4 font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {job.title}
        </h3>

        <div className="flex items-center gap-1.5 text-small text-text-secondary">
          <span className="font-medium truncate">{companyName}</span>
          {region && (
            <>
              <span className="text-border">|</span>
              <span className="truncate">{region}</span>
            </>
          )}
        </div>

        {job.salary_info && (
          <p className="text-small text-text-secondary">
            <span className="text-text-muted">급여</span>{' '}
            <span className="font-medium text-text-primary">{job.salary_info}</span>
          </p>
        )}

        <div className="mt-auto pt-2 border-t border-border flex items-center justify-between text-micro text-text-muted">
          <time dateTime={job.created_at}>{formatRelativeTime(job.created_at)}</time>
          {dDay && (
            <span className={`font-semibold ${urgent ? 'text-state-urgent' : 'text-primary'}`}>
              {dDay}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
