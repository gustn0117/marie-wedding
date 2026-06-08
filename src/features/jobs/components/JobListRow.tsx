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
import VerificationBadge from '@/features/verification/components/VerificationBadge';

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
  const responseRate = Math.round(job.author?.response_rate ?? 0);
  const completedDeals = job.author?.completed_deals_count ?? 0;

  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className={`platform-data-row group grid gap-3 border-b border-gray-100 px-4 py-4 md:grid-cols-[230px_minmax(0,1fr)_168px] md:items-center ${
        tier === 2 ? 'border-l-2 border-l-primary bg-primary-50/60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="company-mark">
            {companyName.charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-bold text-gray-900">{companyName}</p>
              {job.author && (
                <VerificationBadge
                  verificationStatus={job.author.verification_status}
                  phoneVerified={job.author.phone_verified}
                />
              )}
            </div>
            <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">{region}</p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex min-h-[20px] flex-wrap items-center gap-1.5">
          {urgent && <Badge kind="urgent">마감임박</Badge>}
          {fresh && !urgent && <Badge kind="new">NEW</Badge>}
          {tier === 2 && <Badge kind="promoted">추천</Badge>}
        </div>
        <h3 className="truncate text-[16px] font-bold text-ink group-hover:text-primary transition-colors">
          {job.title}
        </h3>
        {/* 메타 라인 — 정보 위계 회복 */}
        {/* 이전: 5-6개 배지가 같은 굵기로 나열 → 정보가 평등하게 보여 우선순위 모호.
            수정: 핵심(고용형태·업종)은 배지, 보조(급여)는 강조 텍스트, 신뢰지표(거래/응답)는 별도 라인 + 미세 톤. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-small text-gray-500">
          <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
          <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
          {job.salary_info && (
            <>
              <span className="text-gray-300" aria-hidden>·</span>
              <span className="font-semibold text-ink">{job.salary_info}</span>
            </>
          )}
        </div>
        {(completedDeals > 0 || responseRate > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            {completedDeals > 0 && <span>거래 <span className="font-bold text-gray-700 tabular-nums">{completedDeals}</span>건</span>}
            {completedDeals > 0 && responseRate > 0 && <span className="text-gray-300" aria-hidden>·</span>}
            {responseRate > 0 && <span>응답률 <span className="font-bold text-gray-700 tabular-nums">{responseRate}%</span></span>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs md:flex-col md:items-end">
        <time className="font-semibold text-gray-400">{formatRelativeTime(job.created_at)}</time>
        {dDay ? (
          <span className={`font-bold ${urgent ? 'text-state-urgent' : 'text-primary'}`}>{dDay}</span>
        ) : (
          <span className="font-bold text-gray-500">상시채용</span>
        )}
        <span className="hidden rounded border border-gray-200 bg-white px-3 py-1.5 font-bold text-gray-700 group-hover:border-ink group-hover:text-ink md:inline-flex">
          상세보기
        </span>
      </div>
    </Link>
  );
}
