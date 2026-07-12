import Link from 'next/link';
import type { Job, Profile } from '@/types/database';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import { getEmploymentTypeLabel, getRegionLabel, formatRelativeTime } from '@/shared/utils/format';

interface Props {
  profile: Pick<Profile, 'id' | 'business_type' | 'region'>;
}

async function fetchRecommended(profile: Pick<Profile, 'id' | 'business_type' | 'region'>): Promise<Job[]> {
  const supabase = createServerQueryClient();
  const baseQuery = supabase
    .from('jobs')
    .select('*, author:profiles!author_id(id, company_name, contact_name)')
    .is('deleted_at', null)
    .eq('hidden_by_admin', false)
    .neq('status', 'hidden')
    .neq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .range(0, 19);

  const bizTypes = (profile.business_type ?? '').split(',').filter(Boolean).map((s) => s.trim());
  const regions = (profile.region ?? '').split(',').filter(Boolean).map((s) => s.trim());
  const expandedRegions = Array.from(new Set(
    regions.flatMap((region) => [region, ...(REGION_DETAILS[region]?.map((detail) => detail.value) ?? [])]),
  ));

  const orParts = [
    bizTypes.length > 0 ? `business_type.in.(${bizTypes.join(',')})` : '',
    expandedRegions.length > 0 ? `region.in.(${expandedRegions.join(',')})` : '',
  ].filter(Boolean);

  const { data: matched } = orParts.length > 0
    ? await baseQuery.or(orParts.join(','))
    : await baseQuery;

  const rows = (matched ?? []) as Job[];
  return rows.filter((j) => !j.deadline || new Date(j.deadline) > new Date()).slice(0, 5);
}

export default async function RecommendedJobs({ profile }: Props) {
  const jobs = await fetchRecommended(profile);
  if (jobs.length === 0) return null;

  return (
    <section className="platform-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">맞춤 공고</h2>
        <Link href={ROUTES.JOBS} className="text-xs font-bold text-primary hover:underline">전체 공고 →</Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={ROUTES.JOBS_DETAIL(job.id)}
              className="flex items-center justify-between gap-3 py-2.5 hover:bg-primary-50/40 -mx-2 px-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{job.title}</p>
                <p className="text-xs text-gray-500 truncate">
                  {(job.author?.company_name || job.author?.contact_name || '')} · {getRegionLabel(job.region)} · {getEmploymentTypeLabel(job.employment_type)}
                </p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(job.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
