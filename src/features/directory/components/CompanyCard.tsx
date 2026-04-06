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
      <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={profile.company_name || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center">
            <span className="text-primary/40 font-serif text-5xl font-bold">
              {(profile.company_name || profile.contact_name).charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
            {profile.company_name || profile.contact_name}
          </h3>
          <span className="text-[10px] font-semibold text-primary bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
            {profile.business_type ? getBusinessTypeLabel(profile.business_type) : '개인'}
          </span>
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
