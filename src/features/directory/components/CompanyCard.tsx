import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';

interface CompanyCardProps {
  profile: Profile;
}

export default function CompanyCard({ profile }: CompanyCardProps) {
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  const displayName = profile.company_name || profile.contact_name;
  const businessTypes = profile.business_type
    ? profile.business_type.split(',').filter(Boolean).map(s => s.trim())
    : [];
  const bioText = profile.bio
    ? profile.bio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      className="block border border-gray-200 overflow-hidden group hover:border-primary transition-colors duration-150"
    >
      {/* Thumbnail */}
      <div className="aspect-[2/1] bg-gray-50 overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className="w-full h-full object-contain p-3" />
        ) : (
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 18.75h.008v.008H18v-.008zm-3-3h.008v.008H15v-.008z" />
            <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth={0.5} />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        {/* 업체명 - 한 줄 전체 사용 */}
        <h3 className="text-[16px] font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1 mb-2">
          {displayName}
        </h3>

        {/* 업종 뱃지 */}
        <div className="flex flex-wrap items-center gap-1 mb-2.5">
          {businessTypes.length > 0 ? (
            <>
              {businessTypes.slice(0, 3).map((bt) => (
                <span key={bt} className="text-[10px] font-bold tracking-tight text-primary bg-primary-50 px-1.5 py-0.5">
                  {getBusinessTypeLabel(bt)}
                </span>
              ))}
              {businessTypes.length > 3 && (
                <span className="text-[10px] font-bold tracking-tight text-gray-500 bg-gray-100 px-1.5 py-0.5">
                  +{businessTypes.length - 3}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] font-bold tracking-tight text-gray-500 bg-gray-100 px-1.5 py-0.5">미등록</span>
          )}
        </div>

        {/* 지역 + 담당자 */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1 min-w-0">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="truncate">{getRegionLabel(profile.region)}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="truncate">{profile.contact_name}</span>
        </div>

        {/* Bio */}
        {bioText && (
          <p className="text-[13px] text-gray-400 line-clamp-2 leading-relaxed">{bioText}</p>
        )}
      </div>
    </Link>
  );
}
