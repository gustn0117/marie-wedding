'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import { getEmploymentTypeLabel, getRegionLabel, formatRelativeTime } from '@/shared/utils/format';
import { RECENT_JOBS_KEY } from '@/features/jobs/components/JobViewTracker';
import type { Job } from '@/types/database';

export default function RecentJobsSection() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(RECENT_JOBS_KEY) || '[]') as string[];
    } catch { /* noop */ }
    ids = ids.filter(Boolean).slice(0, 5);
    if (ids.length === 0) { setJobs([]); return; }

    const sb = createClient();
    sb.from('jobs')
      .select('id, title, region, employment_type, created_at, deadline, view_count, hidden_by_admin, deleted_at')
      .in('id', ids)
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
      .then(({ data }) => {
        // 입력 순서대로 정렬
        const order: Record<string, number> = {};
        ids.forEach((id, i) => { order[id] = i; });
        const sorted = ((data ?? []) as Job[]).sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));
        setJobs(sorted);
      });
  }, []);

  if (jobs === null) return null;
  if (jobs.length === 0) return null;

  return (
    <section className="platform-panel">
      <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">최근 본</p>
          <h2 className="text-sm font-bold text-ink mt-0.5">최근 본 공고</h2>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={ROUTES.JOBS_DETAIL(job.id)}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink group-hover:text-primary truncate">{job.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
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
