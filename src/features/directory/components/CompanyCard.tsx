import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import Badge from '@/shared/components/Badge';
import Logo from '@/shared/components/Logo';
import VerificationBadge from '@/features/verification/components/VerificationBadge';

interface CompanyCardProps {
  profile: Profile;
}

export default function CompanyCard({ profile }: CompanyCardProps) {
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  const displayName = profile.company_name || profile.contact_name;
  const businessTypes = profile.business_type
    ? profile.business_type.split(',').filter(Boolean).map((s) => s.trim())
    : [];
  const bioText = profile.bio
    ? profile.bio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      className="platform-panel block group transition-colors duration-150 hover:border-primary"
    >
      <div className="aspect-[16/9] bg-secondary-50 overflow-hidden flex items-center justify-center border-b border-gray-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={displayName} className="w-full h-full object-contain p-3" />
        ) : (
          <Logo variant="mark" size="lg" className="text-primary-200" />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-1.5 min-w-0">
          <h3 className="text-body-lg font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1 flex-1 min-w-0">
            {displayName}
          </h3>
          <VerificationBadge
            verificationStatus={profile.verification_status}
            phoneVerified={profile.phone_verified}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {businessTypes.length > 0 ? (
            <>
              {businessTypes.slice(0, 3).map((bt) => (
                <Badge key={bt} kind="category">
                  {getBusinessTypeLabel(bt)}
                </Badge>
              ))}
              {businessTypes.length > 3 && <Badge kind="attr">+{businessTypes.length - 3}</Badge>}
            </>
          ) : (
            <Badge kind="attr">미등록</Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-micro text-gray-500 mb-1.5">
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="truncate">{getRegionLabel(profile.region)}</span>
          <span className="text-gray-300">·</span>
          <span className="truncate">{profile.contact_name}</span>
        </div>

        <p className="min-h-[36px] text-small text-gray-500 line-clamp-2 leading-snug">
          {bioText || '업체 소개가 준비 중입니다.'}
        </p>

        {(profile.completed_deals_count > 0 || profile.response_rate > 0) && (
          <p className="mt-2 text-micro text-gray-600">
            {profile.completed_deals_count > 0 && `거래 ${profile.completed_deals_count}건`}
            {profile.completed_deals_count > 0 && profile.response_rate > 0 && ' · '}
            {profile.response_rate > 0 && `응답률 ${Math.round(profile.response_rate)}%`}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-micro font-bold text-gray-400">파트너 상세</span>
          <span className="rounded border border-gray-200 px-2.5 py-1 text-micro font-bold text-primary transition-colors group-hover:border-primary">
            보기
          </span>
        </div>
      </div>
    </Link>
  );
}
