'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Profile, Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { createClient } from '@/lib/supabase/client';
import { directoryService } from '@/features/directory/services/directory-service';
import {
  getBusinessTypeLabel,
  getRegionLabel,
  getEmploymentTypeLabel,
  formatDate,
} from '@/shared/utils/format';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const profileData = await directoryService.getProfileById(id);
        if (!profileData) {
          router.replace(ROUTES.DIRECTORY);
          return;
        }
        setProfile(profileData);

        // Fetch jobs posted by this company
        const supabase = createClient();
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('*')
          .eq('author_id', profileData.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        setJobs((jobsData as Job[]) ?? []);
      } catch (error) {
        console.error('업체 정보를 불러오는 데 실패했습니다:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-5 w-24 bg-secondary rounded" />
        <div className="card">
          <div className="h-8 w-48 bg-secondary rounded mb-4" />
          <div className="flex gap-3 mb-6">
            <div className="h-6 w-20 bg-secondary rounded-full" />
            <div className="h-6 w-16 bg-secondary rounded-full" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full bg-secondary rounded" />
            <div className="h-4 w-3/4 bg-secondary rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary">
        <Link
          href={ROUTES.DIRECTORY}
          className="hover:text-primary transition-colors duration-200"
        >
          업체 디렉토리
        </Link>
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
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
        <span className="text-text-primary font-medium truncate">
          {profile.company_name}
        </span>
      </nav>

      {/* Company Info Card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-text-primary">
              {profile.company_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="badge-primary">
                {profile.business_type ? getBusinessTypeLabel(profile.business_type) : '개인'}
              </span>
              <span className="badge-accent">
                {getRegionLabel(profile.region)}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-secondary/50 rounded-xl mb-6">
          {/* Contact Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
              <svg
                className="w-4.5 h-4.5 text-primary"
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
            </div>
            <div>
              <p className="text-xs text-text-muted">담당자</p>
              <p className="text-sm font-medium text-text-primary">
                {profile.contact_name}
              </p>
            </div>
          </div>

          {/* Phone */}
          {profile.phone && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <svg
                  className="w-4.5 h-4.5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs text-text-muted">연락처</p>
                <a
                  href={`tel:${profile.phone}`}
                  className="text-sm font-medium text-text-primary hover:text-primary transition-colors duration-200"
                >
                  {profile.phone}
                </a>
              </div>
            </div>
          )}

          {/* Website */}
          {profile.website && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <svg
                  className="w-4.5 h-4.5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs text-text-muted">웹사이트</p>
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline truncate block max-w-[200px]"
                >
                  {profile.website}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-2">
              소개
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          </div>
        )}
      </div>

      {/* Jobs Section */}
      <div>
        <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
          채용 공고
        </h2>

        {jobs.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-text-muted">
              현재 등록된 채용 공고가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={ROUTES.JOBS_DETAIL(job.id)}
                className="card group block hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-text-primary group-hover:text-primary transition-colors duration-200 truncate">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="badge-primary text-xs">
                        {getEmploymentTypeLabel(job.employment_type)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {getRegionLabel(job.region)}
                      </span>
                      {job.salary_info && (
                        <span className="text-xs text-text-secondary">
                          {job.salary_info}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {job.is_urgent && (
                      <span className="badge-accent text-xs font-semibold">
                        긴급
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      {formatDate(job.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
