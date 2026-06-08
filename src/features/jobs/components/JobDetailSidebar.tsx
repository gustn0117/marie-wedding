import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { formatDate } from '@/shared/utils/format';
import BookmarkButton from '@/features/bookmarks/components/BookmarkButton';
import ReportButton from '@/features/reports/components/ReportButton';
import VerificationBadge from '@/features/verification/components/VerificationBadge';
import { computeTrustTier, TRUST_TIER_LABELS } from '@/types/database';

interface Props {
  job: Job;
}

export default function JobDetailSidebar({ job }: Props) {
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const daysLeft = job.deadline
    ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const deals = job.author?.completed_deals_count ?? 0;
  const responseRate = Math.round(job.author?.response_rate ?? 0);
  const trustTier = job.author ? computeTrustTier(job.author) : 'unverified';
  const trustEmphasis = trustTier === 'deal_proven' || trustTier === 'business_verified';

  return (
    <aside className="lg:sticky lg:top-20 space-y-3">
      {/* Trust card */}
      <section className={`rounded-xl border ${trustEmphasis ? 'border-primary' : 'border-gray-200'} bg-white p-4`}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">업체 신뢰 등급</p>
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
          <p className={`text-sm font-bold ${trustEmphasis ? 'text-primary' : 'text-ink'}`}>
            {TRUST_TIER_LABELS[trustTier]}
          </p>
          <VerificationBadge
            verificationStatus={job.author?.verification_status}
            phoneVerified={job.author?.phone_verified}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">거래 완료</p>
            <p className="text-base font-bold text-ink tabular-nums">{deals}건</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">응답률</p>
            <div className="flex items-center gap-1.5">
              <p className="text-base font-bold text-ink tabular-nums">{responseRate > 0 ? `${responseRate}%` : '-'}</p>
            </div>
            {responseRate > 0 && (
              <div className="mt-1 h-1 bg-gray-100">
                <div className="h-full bg-gray-800" style={{ width: `${responseRate}%` }} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Apply CTA */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
          {isExpired ? '마감된 공고' : daysLeft !== null && daysLeft <= 7 ? '마감 임박' : '진행 중'}
        </p>
        {job.deadline ? (
          <p className={`text-base font-bold mb-3 ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>
            {formatDate(job.deadline)}{!isExpired && daysLeft !== null ? ` · D-${daysLeft}` : ''}
          </p>
        ) : (
          <p className="text-base font-bold mb-3 text-gray-900">상시 채용</p>
        )}
        <a
          href="#apply"
          className={`block w-full text-center btn-primary min-h-[44px] py-3 ${isExpired ? 'pointer-events-none opacity-50' : ''}`}
        >
          {job.posting_type === 'matching' ? '섭외 문의하기' : '지원하기'}
        </a>
      </section>

      {/* Quick actions */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <BookmarkButton targetType="job" targetId={job.id} label="공고 저장" />
        <ReportButton targetType="job" targetId={job.id} />
      </section>

      {/* Author company short */}
      {job.author && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">업체 정보</p>
          <Link href={ROUTES.DIRECTORY_DETAIL(job.author.id)} className="block group">
            <p className="text-sm font-bold text-gray-900 group-hover:text-primary truncate">
              {job.author.company_name || job.author.contact_name}
            </p>
            <p className="text-xs text-gray-500 mt-1">전체 프로필 보기 →</p>
          </Link>
        </section>
      )}
    </aside>
  );
}
