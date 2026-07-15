import Link from 'next/link';
import type { Job } from '@/types/database';
import {
  formatDate,
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { ROUTES } from '@/shared/constants';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';
import ProfileAvatar from '@/shared/components/ProfileAvatar';

interface Props {
  job: Job;
}

export default function JobDetailHero({ job }: Props) {
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const daysLeft = job.deadline
    ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <section className="bg-white border-y border-gray-200 overflow-hidden">
      {(() => {
        const src = resolveStorageUrl(job.image, 'job-images');
        return src ? (
          <div className="border-b border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={job.title}
              className="w-full max-h-[320px] object-contain"
            />
          </div>
        ) : null;
      })()}

      <div className="p-5 md:p-7">
        {/* Tag row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="inline-flex items-center px-2 py-0.5 bg-ink text-white text-[11px] font-bold rounded">
            채용
          </span>
          {isExpired ? (
            <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] font-bold rounded">마감</span>
          ) : daysLeft !== null && daysLeft <= 7 ? (
            <span className="badge-urgent">마감 {daysLeft}일 전</span>
          ) : null}
          <span className="inline-flex items-center px-2 py-0.5 border border-gray-300 text-gray-700 text-[11px] font-bold rounded">
            {getEmploymentTypeLabel(job.employment_type)}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-bold rounded">
            {getBusinessTypeLabel(job.business_type)}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-[28px] font-bold text-gray-900 leading-tight mb-4">{job.title}</h1>

        {/* Company link */}
        {job.author && (
          <Link
            href={ROUTES.DIRECTORY_DETAIL(job.author.id)}
            className="group inline-flex items-center gap-3 pb-5 mb-5 border-b border-gray-100"
            aria-label={`${job.author.company_name || job.author.contact_name} 업체 상세`}
          >
            <ProfileAvatar
              profileImage={job.author.profile_image}
              name={job.author.company_name || job.author.contact_name || '?'}
              size="sm"
              className="!rounded"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">
                  {job.author.company_name || job.author.contact_name || '알 수 없음'}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                <time>{formatRelativeTime(job.created_at)}</time> 등록
              </p>
            </div>
          </Link>
        )}

        {/* Quick info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 border border-gray-200 bg-gray-50">
          <QuickInfo label="근무지역" value={getRegionLabel(job.region)} />
          <QuickInfo label="고용형태" value={getEmploymentTypeLabel(job.employment_type)} />
          <QuickInfo label="급여" value={job.salary_info || '면접 후 결정'} emphasis />
          <QuickInfo
            label="마감일"
            value={job.deadline ? formatDate(job.deadline) : '상시 채용'}
            danger={isExpired}
          />
        </div>
      </div>
    </section>
  );
}

function QuickInfo({
  label,
  value,
  emphasis,
  danger,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="px-4 py-3 border-r border-b border-gray-200 last:border-r-0 sm:last:border-r-0 md:[&:nth-child(4)]:border-r-0 md:[&:nth-child(n+3)]:border-b-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-bold break-words ${danger ? 'text-state-urgent' : emphasis ? 'text-primary' : 'text-gray-800'}`}>
        {value}
      </p>
    </div>
  );
}
