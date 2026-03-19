import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';

interface JobCardProps {
  job: Job;
}

function getEmploymentBadgeClass(employmentType: string, isUrgent: boolean): string {
  if (isUrgent) return 'badge-urgent';
  if (employmentType === 'full_time') return 'badge-primary';
  return 'badge-accent';
}

export default function JobCard({ job }: JobCardProps) {
  const companyName = job.author?.company_name ?? '알 수 없음';
  const region = job.author?.region ? getRegionLabel(job.author.region) : '';

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="block group">
      <article className="card p-5 h-full flex flex-col gap-3 transition-shadow duration-200 group-hover:shadow-md">
        {/* Header: Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {job.is_urgent && (
            <span className="badge-urgent text-xs font-semibold px-2.5 py-1 rounded-full">
              긴급
            </span>
          )}
          <span
            className={`${getEmploymentBadgeClass(job.employment_type, false)} text-xs font-medium px-2.5 py-1 rounded-full`}
          >
            {getEmploymentTypeLabel(job.employment_type)}
          </span>
          <span className="badge-accent text-xs font-medium px-2.5 py-1 rounded-full">
            {getBusinessTypeLabel(job.business_type)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {job.title}
        </h3>

        {/* Company & Region */}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="font-medium">{companyName}</span>
          {region && (
            <>
              <span className="text-border">|</span>
              <span>{region}</span>
            </>
          )}
        </div>

        {/* Salary */}
        {job.salary_info && (
          <p className="text-sm text-text-secondary">
            <span className="text-text-muted">급여</span>{' '}
            <span className="font-medium text-text-primary">{job.salary_info}</span>
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <time dateTime={job.created_at}>{formatRelativeTime(job.created_at)}</time>
          {job.deadline && (
            <span className="text-accent-600">
              마감 {new Date(job.deadline).toLocaleDateString('ko-KR')}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
