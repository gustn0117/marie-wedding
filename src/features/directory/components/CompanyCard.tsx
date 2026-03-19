import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';

interface CompanyCardProps {
  profile: Profile;
}

export default function CompanyCard({ profile }: CompanyCardProps) {
  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      className="card group block hover:shadow-lg transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-text-primary group-hover:text-primary transition-colors duration-200 truncate">
          {profile.company_name}
        </h3>
        <span className="badge-primary shrink-0">
          {profile.business_type ? getBusinessTypeLabel(profile.business_type) : '개인'}
        </span>
      </div>

      {/* Info */}
      <div className="flex items-center gap-4 mb-3 text-sm text-text-secondary">
        <span className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          {getRegionLabel(profile.region)}
        </span>

        <span className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
          {profile.contact_name}
        </span>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
          {profile.bio}
        </p>
      )}

      {/* Footer CTA */}
      <div className="mt-4 pt-3 border-t border-border">
        <span className="text-xs font-medium text-primary group-hover:underline">
          상세 보기 &rarr;
        </span>
      </div>
    </Link>
  );
}
