import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getEmploymentTypeLabel, getRegionLabel } from '@/shared/utils/format';

interface JobCardProps {
  job: Job;
  idx?: number;
}

const GRADIENTS = [
  'from-rose-100 to-orange-100',
  'from-amber-100 to-yellow-100',
  'from-emerald-100 to-teal-100',
  'from-sky-100 to-indigo-100',
  'from-fuchsia-100 to-pink-100',
  'from-violet-100 to-purple-100',
  'from-lime-100 to-emerald-100',
  'from-cyan-100 to-sky-100',
];
const EMOJIS = ['💍', '👗', '📸', '💄', '📋', '🎀', '🎤', '🎵', '✏️'];

export default function JobCard({ job, idx = 0 }: JobCardProps) {
  const g = GRADIENTS[idx % GRADIENTS.length];
  const emoji = EMOJIS[idx % EMOJIS.length];
  const company = job.author?.company_name || job.author?.contact_name || '업체명 미등록';
  const verified = job.author?.verification_status === 'verified';
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const views = job.view_count ?? 0;

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="svc-card">
      <div className={`svc-card-thumb bg-gradient-to-br ${g}`}>
        {isExpired ? (
          <span className="svc-card-badge" style={{ background: '#6b7280' }}>마감</span>
        ) : job.is_promoted ? (
          <span className="svc-card-badge svc-card-badge-promoted">추천</span>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-30">{emoji}</div>
      </div>
      <p className="svc-card-title">{job.title}</p>
      <div className="svc-card-rating">
        <span className="font-bold text-gray-900">조회 {views.toLocaleString()}</span>
        <span className="svc-card-rating-count">{getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)}</span>
      </div>
      <p className="svc-card-price">{job.salary_info || '면접 후 결정'}</p>
      <div className="svc-card-seller">
        <span className="truncate flex-1">{company}</span>
        {verified && <span className="svc-card-m-badge">인</span>}
      </div>
    </Link>
  );
}
