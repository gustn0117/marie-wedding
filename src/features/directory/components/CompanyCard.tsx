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

  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      className="block rounded-xl border border-gray-200 overflow-hidden group hover:shadow-lg transition-all duration-300"
    >
      {/* Thumbnail */}
      <div className="aspect-[2/1] bg-gray-50 overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={profile.company_name || ''} className="w-full h-full object-contain p-3" />
        ) : (
          <div className="w-full h-full bg-gray-50 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 18.75h.008v.008H18v-.008zm-3-3h.008v.008H15v-.008z" />
              <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth={0.5} />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
            {profile.company_name || profile.contact_name}
          </h3>
          {profile.business_type ? (
            profile.business_type.split(',').filter(Boolean).map(bt => (
              <span key={bt} className="text-[10px] font-semibold text-primary bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
                {getBusinessTypeLabel(bt.trim())}
              </span>
            ))
          ) : (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">미등록</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {getRegionLabel(profile.region)}
          </span>
          <span>{profile.contact_name}</span>
        </div>

        {profile.bio && (
          <p className="text-[13px] text-gray-400 line-clamp-2 leading-relaxed">
            {profile.bio}
          </p>
        )}
      </div>
    </Link>
  );
}
