import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getEmploymentTypeLabel, getRegionLabel } from '@/shared/utils/format';
import SafeImage from '@/shared/components/SafeImage';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job }: JobCardProps) {
  const company = job.author?.company_name || job.author?.contact_name || '업체명 미등록';
  const initial = company.charAt(0).toUpperCase();
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const imageUrl = resolveStorageUrl(job.image, 'job-images');

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="svc-card">
      <div className="svc-card-thumb bg-gray-50">
        {/* 배지: 마감 > 스폰서 > prime 슬롯 통일. */}
        {isExpired ? (
          <span className="svc-card-badge" style={{ background: '#6b7280' }}>마감</span>
        ) : job.is_promoted ? (
          <span className="svc-card-badge svc-card-badge-promoted">스폰서</span>
        ) : null}
        <SafeImage
          src={imageUrl}
          alt={job.title}
          className="svc-card-thumb-img"
          wrapperClassName="absolute inset-0 flex items-center justify-center"
          fallback={<span className="text-5xl font-bold text-gray-300 select-none">{initial}</span>}
        />
      </div>
      <div className="svc-card-body">
        <p className="svc-card-title">{job.title}</p>
        <div className="svc-card-rating">
          <span className="svc-card-rating-count">
            {getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)}
          </span>
        </div>
        <p className="svc-card-price">{job.salary_info || '면접 후 결정'}</p>
        <div className="svc-card-seller">
          <span className="truncate flex-1">{company}</span>
        </div>
      </div>
    </Link>
  );
}
