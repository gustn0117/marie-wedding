'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { createClient } from '@/lib/supabase/client';
import { formatDate, getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Job } from '@/types/database';

interface EventItem {
  id: string;
  type: 'urgent_job' | 'new_company' | 'hot_post';
  title: string;
  description: string;
  date: string;
  link: string;
  badge: string;
  badgeColor: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [urgentJobs, setUrgentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      const supabase = createClient();

      try {
        // Fetch urgent jobs as "events"
        const { data: urgentData } = await supabase
          .from('jobs')
          .select('*, author:profiles!author_id(*)')
          .is('deleted_at', null)
          .eq('is_urgent', true)
          .order('created_at', { ascending: false })
          .limit(6);

        setUrgentJobs((urgentData as Job[]) ?? []);

        // Fetch recent activity to create event-like items
        const [{ data: recentJobs }, { data: recentPosts }] = await Promise.all([
          supabase
            .from('jobs')
            .select('id, title, business_type, region, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('posts')
            .select('id, title, category, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const eventItems: EventItem[] = [];

        (recentJobs ?? []).forEach((job) => {
          eventItems.push({
            id: `job-${job.id}`,
            type: 'urgent_job',
            title: job.title,
            description: `${getBusinessTypeLabel(job.business_type)} · ${getRegionLabel(job.region)}`,
            date: job.created_at,
            link: ROUTES.JOBS_DETAIL(job.id),
            badge: '채용',
            badgeColor: 'bg-blue-50 text-blue-600',
          });
        });

        (recentPosts ?? []).forEach((post) => {
          eventItems.push({
            id: `post-${post.id}`,
            type: 'hot_post',
            title: post.title,
            description: post.category === 'news' ? '업계뉴스' : post.category === 'tips' ? '노하우공유' : '자유게시판',
            date: post.created_at,
            link: ROUTES.COMMUNITY_DETAIL(post.id),
            badge: '커뮤니티',
            badgeColor: 'bg-green-50 text-green-600',
          });
        });

        eventItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEvents(eventItems.slice(0, 10));
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-secondary rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse p-5">
              <div className="h-5 w-3/4 bg-secondary rounded mb-2" />
              <div className="h-4 w-1/2 bg-secondary rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">이벤트 & 소식</h1>

      {/* Urgent Jobs Banner */}
      {urgentJobs.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">긴급 채용 공고</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {urgentJobs.map((job) => (
              <Link
                key={job.id}
                href={ROUTES.JOBS_DETAIL(job.id)}
                className="card group border-red-100 hover:border-red-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge-urgent text-xs">긴급</span>
                  <span className="text-xs text-text-muted">{getRegionLabel(job.region)}</span>
                </div>
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors line-clamp-2 mb-1">
                  {job.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {job.author?.company_name || '알 수 없음'}
                </p>
                {job.deadline && (
                  <p className="text-xs text-red-500 mt-2">마감: {formatDate(job.deadline)}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Timeline */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">최근 활동</h2>
        {events.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-text-muted">아직 활동 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={event.link}
                className="card block group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${event.badgeColor}`}>
                        {event.badge}
                      </span>
                      <span className="text-xs text-text-muted">{formatDate(event.date)}</span>
                    </div>
                    <h3 className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                      {event.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">{event.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
