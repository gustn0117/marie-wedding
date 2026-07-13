import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { formatDate } from '@/shared/utils/format';
import BookmarkButton from '@/features/bookmarks/components/BookmarkButton';
import ReportButton from '@/features/reports/components/ReportButton';

interface Props {
  job: Job;
  /** 지원 차단 사유 (예: 업체 회원은 지원 불가). null이면 정상 CTA 노출. */
  blockReason?: string | null;
}

export default function JobDetailSidebar({ job, blockReason }: Props) {
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const daysLeft = job.deadline
    ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <aside className="lg:sticky lg:top-20 space-y-3">
      {/* Apply CTA */}
      <section className="surface p-4">
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
        {blockReason ? (
          <div
            className="block w-full text-center rounded bg-gray-100 text-gray-500 py-3 text-sm font-bold"
            aria-disabled="true"
          >
            {blockReason}
          </div>
        ) : (
          <a
            href="#apply"
            className={`block w-full text-center btn-primary min-h-[44px] py-3 ${isExpired ? 'pointer-events-none opacity-50' : ''}`}
          >
            지원하기
          </a>
        )}
      </section>

      {/* Quick actions */}
      <section className="surface p-4 space-y-2">
        <BookmarkButton targetType="job" targetId={job.id} label="공고 저장" />
        <ReportButton targetType="job" targetId={job.id} />
      </section>

      {/* Author company short */}
      {job.author && (
        <section className="surface p-4">
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
