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

interface Props {
  job: Job;
}

export default function JobListRow({ job }: Props) {
  const tier = getJobTier(job);
  const dDay = getDDayLabel(job.deadline);
  const urgent = isUrgent(job.deadline);
  const fresh = isNew(job.created_at);
  const companyName = job.author?.company_name ?? job.author?.contact_name ?? '알 수 없음';
  const region = job.author?.region ? getRegionLabel(job.author.region) : getRegionLabel(job.region);

  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className={`group grid gap-3 border-b border-gray-100 bg-white px-4 py-4 transition-colors hover:bg-primary-50/45 md:grid-cols-[210px_1fr_150px] md:items-center ${
        tier === 2 ? 'border-l-2 border-l-primary bg-primary-50/60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-200 bg-secondary-50 text-sm font-bold text-primary">
            {companyName.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{companyName}</p>
            <p className="mt-0.5 text-xs text-gray-500">{region}</p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex min-h-[20px] flex-wrap items-center gap-1.5">
          {urgent && <Badge kind="urgent">마감임박</Badge>}
          {fresh && !urgent && <Badge kind="new">NEW</Badge>}
          {tier === 2 && <Badge kind="promoted">추천</Badge>}
        </div>
        <h3 className="truncate text-[16px] font-bold text-gray-950 group-hover:text-primary transition-colors">
          {job.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-small text-gray-500">
          <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
          <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
          {job.salary_info && <span className="font-semibold text-gray-700">{job.salary_info}</span>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs md:flex-col md:items-end">
        <time className="text-gray-400">{formatRelativeTime(job.created_at)}</time>
        {dDay ? (
          <span className={`font-bold ${urgent ? 'text-state-urgent' : 'text-primary'}`}>{dDay}</span>
        ) : (
          <span className="font-bold text-gray-500">상시채용</span>
        )}
        <span className="hidden rounded border border-gray-200 bg-white px-3 py-1.5 font-bold text-primary group-hover:border-primary md:inline-flex">
          상세보기
        </span>
      </div>
    </Link>
  );
}
