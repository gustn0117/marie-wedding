import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';

interface CompanyCardProps {
  profile: Profile;
  idx?: number;
}

const GRADIENTS = [
  'from-violet-100 to-fuchsia-100',
  'from-blue-100 to-cyan-100',
  'from-emerald-100 to-lime-100',
  'from-orange-100 to-rose-100',
  'from-amber-100 to-pink-100',
  'from-sky-100 to-indigo-100',
  'from-fuchsia-100 to-pink-100',
  'from-cyan-100 to-teal-100',
];

export default function CompanyCard({ profile, idx = 0 }: CompanyCardProps) {
  const g = GRADIENTS[idx % GRADIENTS.length];
  const name = profile.company_name || profile.contact_name;
  const verified = profile.verification_status === 'verified';
  const premium = profile.premium_tier !== 'free';
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;
  const deals = profile.completed_deals_count ?? 0;
  const responseRate = Math.round(profile.response_rate ?? 0);

  return (
    <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="svc-card">
      <div className={`svc-card-thumb bg-gradient-to-br ${g}`}>
        {premium ? (
          <span className="svc-card-badge svc-card-badge-prime">PREMIUM</span>
        ) : verified ? (
          <span className="svc-card-badge svc-card-badge-promoted">✓ 인증</span>
        ) : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="svc-card-thumb-img" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-extrabold text-white/70">
            {name.charAt(0)}
          </div>
        )}
      </div>
      <p className="svc-card-title">{name}</p>
      <div className="svc-card-rating">
        <span className="font-bold text-gray-900">거래 {deals.toLocaleString()}건</span>
        {responseRate > 0 && <span className="svc-card-rating-count">응답률 {responseRate}%</span>}
      </div>
      <p className="svc-card-price">
        {profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : '파트너'} · {getRegionLabel(profile.region)}
      </p>
      <div className="svc-card-seller">
        <span className="truncate flex-1">{profile.contact_name || '담당자'}</span>
        {verified && <span className="svc-card-m-badge">인</span>}
      </div>
    </Link>
  );
}
