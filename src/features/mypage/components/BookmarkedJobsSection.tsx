import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { getEmploymentTypeLabel, getRegionLabel, formatRelativeTime } from '@/shared/utils/format';
import type { Job } from '@/types/database';

interface Props {
  profileId: string;
}

export default async function BookmarkedJobsSection({ profileId }: Props) {
  const supabase = createServerQueryClient();
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('target_id, created_at')
    .eq('profile_id', profileId)
    .eq('target_type', 'job')
    .order('created_at', { ascending: false })
    .limit(5);

  const ids = ((bookmarks ?? []) as Array<{ target_id: string }>).map((b) => b.target_id);
  if (ids.length === 0) return null;

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, region, employment_type, status, created_at, deadline')
    .in('id', ids)
    .is('deleted_at', null)
    .eq('hidden_by_admin', false);

  const order: Record<string, number> = {};
  ids.forEach((id, i) => { order[id] = i; });
  const sortedJobs = ((jobs ?? []) as Pick<Job, 'id' | 'title' | 'region' | 'employment_type' | 'status' | 'created_at' | 'deadline'>[])
    .sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));

  if (sortedJobs.length === 0) return null;

  return (
    <section className="platform-panel">
      <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Bookmarks</p>
          <h2 className="text-sm font-bold text-gray-900 mt-0.5">저장한 공고</h2>
        </div>
        <Link href={ROUTES.JOBS} className="text-xs font-bold text-primary hover:underline">전체 공고 →</Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {sortedJobs.map((job) => (
          <li key={job.id}>
            <Link
              href={ROUTES.JOBS_DETAIL(job.id)}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-primary-50/40 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  {(job.status === 'closed' || job.status === 'filled') && (
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded">
                      {job.status === 'filled' ? '채용완료' : '마감'}
                    </span>
                  )}
                  <p className="text-sm font-bold text-gray-900 group-hover:text-primary truncate">{job.title}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)}
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
