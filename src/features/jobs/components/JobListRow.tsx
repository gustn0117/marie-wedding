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
  const imageUrl = job.image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${job.image}`
    : null;

  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className={`group flex gap-4 border-b border-gray-100 px-4 py-4 transition-colors hover:bg-gray-50/60 ${
        tier === 2 ? 'border-l-2 border-l-primary bg-primary-50/40' : ''
      }`}
    >
      {/* 썸네일 — 96x96, 이미지 또는 이니셜 fallback (이미지 마크 중복 제거) */}
      <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={job.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl font-extrabold text-gray-300 tracking-tighter">
              {companyName.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* 본문 — flex 1, 최대 폭 사용 */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        {/* 상단: 회사 메타 + 배지 */}
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-1">
            <span className="font-semibold truncate">{companyName}</span>
            {job.author && (
              <VerificationBadge
                verificationStatus={job.author.verification_status}
                phoneVerified={job.author.phone_verified}
              />
            )}
            <span className="text-gray-300" aria-hidden>·</span>
            <span className="truncate">{region}</span>
          </div>

          {/* 제목 — 큰 강조 */}
          <h3 className="text-[17px] sm:text-[18px] font-bold text-ink leading-snug tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
            {job.title}
          </h3>

          {/* 배지 행 — 상태 + 직군 + 고용형태 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {urgent && <Badge kind="urgent">마감임박</Badge>}
            {fresh && !urgent && <Badge kind="new">NEW</Badge>}
            {tier === 2 && <Badge kind="promoted">추천</Badge>}
            <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
            <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
            {job.salary_info && (
              <>
                <span className="text-gray-300" aria-hidden>·</span>
                <span className="text-[13px] font-bold text-primary">{job.salary_info}</span>
              </>
            )}
          </div>
        </div>

        {/* 하단: 거래/응답률 (있을 때만) */}
        {(completedDeals > 0 || responseRate > 0) && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
            {completedDeals > 0 && (
              <span>거래 <span className="font-bold text-gray-700 tabular-nums">{completedDeals}</span>건</span>
            )}
            {completedDeals > 0 && responseRate > 0 && <span className="text-gray-300" aria-hidden>·</span>}
            {responseRate > 0 && (
              <span>응답률 <span className="font-bold text-gray-700 tabular-nums">{responseRate}%</span></span>
            )}
          </div>
        )}
      </div>

      {/* 우측 메타 — 시각/상태/CTA 세로 정렬 */}
      <div className="shrink-0 flex flex-col items-end justify-between text-right gap-2 min-w-[88px]">
        <time className="text-[11px] font-semibold text-gray-400">
          {formatRelativeTime(job.created_at)}
        </time>
        {dDay ? (
          <span className={`text-[12px] font-bold tabular-nums ${urgent ? 'text-rose-500' : 'text-primary'}`}>
            {dDay}
          </span>
        ) : (
          <span className="text-[12px] font-bold text-gray-500">상시채용</span>
        )}
        <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-600 group-hover:bg-ink group-hover:text-white group-hover:border-ink transition-colors">
          상세보기
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
