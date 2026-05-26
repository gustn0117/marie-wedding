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
import { JOB_STATUS_LABELS } from '@/shared/constants';

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
  const isVerified = job.author?.verification_status === 'verified';
  const deals = job.author?.completed_deals_count ?? 0;
  const responseRate = Math.round(job.author?.response_rate ?? 0);

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="block group">
      <article
        className={`platform-panel ${tierClass} relative flex h-full min-h-[270px] flex-col gap-3 p-4 transition-all group-hover:border-primary group-hover:shadow-sm ${isVerified ? 'border-l-4 border-l-primary' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-small text-text-secondary flex-wrap">
              <span className="company-mark !h-8 !w-8 text-[11px]">
                {companyName.charAt(0)}
              </span>
              <span className="truncate font-bold text-gray-900 max-w-[140px]">{companyName}</span>
              {job.author && (
                <VerificationBadge
                  verificationStatus={job.author.verification_status}
                  phoneVerified={job.author.phone_verified}
                />
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 flex-wrap justify-end min-h-[18px]">
            {job.status === 'filled' && <Badge kind="promoted">{JOB_STATUS_LABELS.filled}</Badge>}
            {job.status === 'closed' && <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded">{JOB_STATUS_LABELS.closed}</span>}
            {(job.status === 'urgent' || (urgent && job.status === 'open')) && <Badge kind="urgent">마감임박</Badge>}
            {fresh && !urgent && job.status === 'open' && <Badge kind="new">NEW</Badge>}
            {tier === 2 && job.status === 'open' && <Badge kind="promoted">추천</Badge>}
            {job.is_promoted && <Badge kind="promoted">PROMO</Badge>}
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

        <div className="rounded border border-gray-100 bg-secondary-50 px-3 py-2">
          <p className="text-[11px] font-bold text-gray-400">급여</p>
          <p className="mt-0.5 truncate text-sm font-bold text-gray-900">{job.salary_info || '협의 후 결정'}</p>
        </div>

        {/* Trust signals row */}
        {(deals > 0 || responseRate > 0) && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
            {deals > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">거래</p>
                <p className="text-sm font-bold text-gray-900 tabular-nums">{deals}건</p>
              </div>
            )}
            {responseRate > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">응답률</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{responseRate}%</p>
                  <div className="flex-1 h-1 bg-gray-100">
                    <div className="h-full bg-gray-800" style={{ width: `${responseRate}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between text-micro text-text-muted">
          <time dateTime={job.created_at}>{formatRelativeTime(job.created_at)}</time>
          <div className="flex items-center gap-2">
            {job.view_count > 0 && <span className="text-gray-400 tabular-nums">조회 {job.view_count}</span>}
            {dDay && (
              <span className={`font-semibold tabular-nums ${urgent ? 'text-state-urgent' : 'text-primary'}`}>
                {dDay}
              </span>
            )}
            {!dDay && <span className="font-semibold text-gray-500">상시</span>}
          </div>
        </div>
      </article>
    </Link>
  );
}
