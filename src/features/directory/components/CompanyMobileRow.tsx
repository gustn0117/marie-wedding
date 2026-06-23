import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import SafeImage from '@/shared/components/SafeImage';

interface Props {
  profile: Profile;
}

/**
 * 디렉토리 모바일 1열 compact row.
 * - 좌측 64×64 썸네일 (이미지 없으면 이니셜)
 * - 우측 회사명·인증·업종·지역·진행/응답률
 */
export default function CompanyMobileRow({ profile }: Props) {
  const name = profile.company_name || profile.contact_name;
  const initial = name.charAt(0).toUpperCase();
  const verified = profile.verification_status === 'verified';
  const premium = profile.premium_tier !== 'free';
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;
  const deals = profile.completed_deals_count ?? 0;
  const responseRate = Math.round(profile.response_rate ?? 0);
  const isNewBiz = deals === 0;
  const bizLabel = profile.business_type
    ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim())
    : '프로필';
  const region = getRegionLabel(profile.region);

  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      className="flex items-start gap-3 px-3 py-3 hover:bg-primary-50/40 transition-colors"
    >
      {/* 썸네일 */}
      <div className="shrink-0 relative w-16 h-16 rounded overflow-hidden bg-gray-50 border border-gray-200">
        <SafeImage
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          wrapperClassName="absolute inset-0 flex items-center justify-center"
          fallback={<span className="text-xl font-bold text-gray-300 select-none">{initial}</span>}
        />
        {premium && (
          <span className="absolute top-0 left-0 bg-ink text-white text-[9px] font-bold px-1 py-0.5">PRIME</span>
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[14.5px] font-bold text-ink truncate">{name}</p>
          {verified && (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0 rounded text-[10px] font-bold text-primary border border-primary-200 bg-primary-50">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              인증
            </span>
          )}
        </div>
        <p className="text-[12px] text-gray-500 mt-0.5 truncate">
          {bizLabel} · {region}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-gray-600 flex-wrap">
          {isNewBiz && responseRate === 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary-50 text-primary text-[10px] font-bold">
              NEW
            </span>
          ) : (
            <>
              {deals > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  진행 <span className="font-bold text-ink tabular-nums">{deals.toLocaleString()}</span>건
                </span>
              )}
              {deals > 0 && responseRate > 0 && <span className="text-gray-300" aria-hidden>·</span>}
              {responseRate > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  응답률 <span className="font-bold text-ink tabular-nums">{responseRate}%</span>
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
