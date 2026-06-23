import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import SafeImage from '@/shared/components/SafeImage';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';

interface CompanyCardProps {
  profile: Profile;
}

export default function CompanyCard({ profile }: CompanyCardProps) {
  const name = profile.company_name || profile.contact_name;
  const initial = name.charAt(0).toUpperCase();
  const verified = profile.verification_status === 'verified';
  const premium = profile.premium_tier !== 'free';
  const imageUrl = resolveStorageUrl(profile.profile_image, 'avatars');
  const deals = profile.completed_deals_count ?? 0;
  const responseRate = Math.round(profile.response_rate ?? 0);
  const isNewBiz = deals === 0;
  const bizLabel = profile.business_type
    ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim())
    : '프로필';
  const region = getRegionLabel(profile.region);

  return (
    <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="svc-card">
      {/* 썸네일 */}
      <div className="svc-card-thumb bg-gray-50">
        {premium ? (
          <span className="svc-card-badge svc-card-badge-prime">PREMIUM</span>
        ) : verified ? (
          <span className="svc-card-badge svc-card-badge-promoted inline-flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            인증
          </span>
        ) : null}
        <SafeImage
          src={imageUrl}
          alt={name}
          className="svc-card-thumb-img"
          wrapperClassName="absolute inset-0 flex items-center justify-center"
          fallback={<span className="text-5xl font-bold text-gray-300 select-none">{initial}</span>}
        />
      </div>

      {/* 본문 */}
      <div className="svc-card-body">
        {/* 메타: 업종 · 지역 */}
        <div className="svc-card-meta-row">
          <span className="truncate">{bizLabel}</span>
          <span className="text-gray-300" aria-hidden>·</span>
          <span className="truncate">{region}</span>
        </div>

        {/* 업체명 (타이틀) */}
        <p className="svc-card-title">{name}</p>

        {/* 진행 이력 / 응답률 또는 NEW 배지 */}
        <div className="svc-card-rating">
          {isNewBiz && responseRate === 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary-50 text-primary text-[10px] font-bold">NEW</span>
          ) : (
            <>
              {deals > 0 && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  진행 <span className="font-bold text-ink tabular-nums">{deals.toLocaleString()}</span>건
                </span>
              )}
              {deals > 0 && responseRate > 0 && <span className="text-gray-300" aria-hidden>·</span>}
              {responseRate > 0 && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  응답률 <span className="font-bold text-ink tabular-nums">{responseRate}%</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* 강조 라인 — 담당자 또는 가격 자리 */}
        {profile.contact_name && (
          <p className="svc-card-price !text-gray-700 !text-[13px]">
            담당 {profile.contact_name}
          </p>
        )}

        {/* 푸터 */}
        <div className="svc-card-seller justify-between">
          <span className="truncate">{name}</span>
          {verified && <span className="svc-card-m-badge shrink-0" title="인증 업체">인</span>}
        </div>
      </div>
    </Link>
  );
}
