import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime, getEmploymentTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Job } from '@/types/database';

interface Props {
  authorId: string;
  currentJobId: string;
}

export default async function RelatedJobs({ authorId, currentJobId }: Props) {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('jobs')
    .select('id, title, region, employment_type, created_at, deadline')
    .eq('author_id', authorId)
    .neq('id', currentJobId)
    .is('deleted_at', null)
    .eq('hidden_by_admin', false)
    .neq('status', 'hidden')
    .order('created_at', { ascending: false })
    .limit(5);

  const jobs = (data ?? []) as Pick<Job, 'id' | 'title' | 'region' | 'employment_type' | 'created_at' | 'deadline'>[];
  if (jobs.length === 0) return null;

  return (
    <section className="rounded-xl bg-white border border-gray-200 p-6 md:p-8">
      <h2 className="text-lg font-bold text-ink mb-4 pb-3 border-b border-gray-200">
        이 업체의 다른 공고
      </h2>
      <ul className="divide-y divide-gray-100">
        {jobs.map((job) => {
          const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
          return (
            <li key={job.id}>
              <Link
                href={ROUTES.JOBS_DETAIL(job.id)}
                className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 -mx-3 px-3 rounded-lg transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink group-hover:text-primary truncate">
                    {job.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {isExpired ? (
                    <span className="text-xs text-gray-400">마감</span>
                  ) : (
                    <span className="text-xs text-gray-500">{formatRelativeTime(job.created_at)}</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
