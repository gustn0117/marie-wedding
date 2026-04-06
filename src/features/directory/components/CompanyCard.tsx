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
      className="card group block hover:shadow-lg transition-all duration-300"
    >
      {/* Header with Thumbnail */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={profile.company_name || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">
                {(profile.company_name || profile.contact_name).charAt(0)}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
              {profile.company_name || profile.contact_name}
            </h3>
            <span className="badge-primary shrink-0 text-[10px]">
              {profile.business_type ? getBusinessTypeLabel(profile.business_type) : '개인'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {getRegionLabel(profile.region)}
            </span>
            <span>{profile.contact_name}</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
          {profile.bio}
        </p>
      )}

      {/* Footer CTA */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs font-medium text-primary group-hover:underline">
          상세 보기 &rarr;
        </span>
      </div>
    </Link>
  );
}
