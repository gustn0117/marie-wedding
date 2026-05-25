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
import VerificationBadge from '@/features/verification/components/VerificationBadge';

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
      <article className={`platform-panel ${tierClass} h-full min-h-[230px] p-4 flex flex-col gap-3 transition-colors group-hover:border-primary`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-small text-text-secondary">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-200 bg-primary-50 text-xs font-bold text-primary">
                {companyName.charAt(0)}
              </span>
              <span className="truncate font-bold text-gray-900">{companyName}</span>
              {job.author && (
                <VerificationBadge
                  verificationStatus={job.author.verification_status}
                  phoneVerified={job.author.phone_verified}
                />
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 flex-wrap justify-end min-h-[18px]">
            {urgent && <Badge kind="urgent">마감임박</Badge>}
            {fresh && !urgent && <Badge kind="new">NEW</Badge>}
            {tier === 2 && <Badge kind="promoted">추천</Badge>}
          </div>
        </div>

        <h3 className="text-[17px] font-bold text-text-primary leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {job.title}
        </h3>

        <div className="flex items-center gap-1.5 text-small text-text-secondary">
          <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="truncate">{region || getRegionLabel(job.region)}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
          <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
        </div>

        {job.salary_info && (
          <p className="text-small text-text-secondary">
            <span className="text-text-muted">급여</span>{' '}
            <span className="font-medium text-text-primary">{job.salary_info}</span>
          </p>
        )}

        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between text-micro text-text-muted">
          <time dateTime={job.created_at}>{formatRelativeTime(job.created_at)}</time>
          {dDay && (
            <span className={`font-semibold ${urgent ? 'text-state-urgent' : 'text-primary'}`}>
              {dDay}
            </span>
          )}
          {!dDay && <span className="font-semibold text-gray-500">상시채용</span>}
        </div>
      </article>
    </Link>
  );
}
