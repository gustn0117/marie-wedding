import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';

interface CompanyCardProps {
  profile: Profile;
}

export default function CompanyCard({ profile }: CompanyCardProps) {
  const name = profile.company_name || profile.contact_name;
  const initial = name.charAt(0).toUpperCase();
  const verified = profile.verification_status === 'verified';
  const premium = profile.premium_tier !== 'free';
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;
  const deals = profile.completed_deals_count ?? 0;
  const responseRate = Math.round(profile.response_rate ?? 0);
  const isNew = deals === 0; // 거래 0건이면 부정 라벨 대신 "신규" 표시

  return (
    <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="svc-card">
      <div className="svc-card-thumb bg-gray-50">
        {premium ? (
          <span className="svc-card-badge svc-card-badge-prime">PREMIUM</span>
        ) : verified ? (
          <span className="svc-card-badge svc-card-badge-promoted">✓ 인증</span>
        ) : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="svc-card-thumb-img" />
        ) : (
          // 이전: text-white/70 큰 이니셜 — 그라데이션 배경에 가려 가독성 낮음.
          // 회색 단색 배경 + gray-300 이니셜로 통일.
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold text-gray-300 select-none">{initial}</span>
          </div>
        )}
      </div>
      <p className="svc-card-title">{name}</p>
      <div className="svc-card-rating">
        {/* C-3: 거래 0건/응답률 0%는 신규 업체에게 부정적. 0인 경우 "신규" 배지로 전환. */}
        {isNew && responseRate === 0 ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary-50 text-primary text-[10px] font-bold">NEW</span>
        ) : (
          <>
            {deals > 0 && <span className="font-bold text-gray-900">거래 {deals.toLocaleString()}건</span>}
            {responseRate > 0 && <span className="svc-card-rating-count">응답률 {responseRate}%</span>}
          </>
        )}
      </div>
      <p className="svc-card-price">
        {profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : '파트너'} · {getRegionLabel(profile.region)}
      </p>
      <div className="svc-card-seller">
        <span className="truncate flex-1">{profile.contact_name || '담당자'}</span>
        {verified && <span className="svc-card-m-badge" title="인증 업체">인</span>}
      </div>
    </Link>
  );
}
