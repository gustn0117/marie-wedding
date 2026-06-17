import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import {
  formatDate,
  formatRelativeTime,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { EVENT_TYPES } from '@/features/events/types';
import type { Event, Job } from '@/types/database';
import RichTextView from '@/shared/components/RichTextView';
import { ROUTES } from '@/shared/constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getEvent(id: string): Promise<Event | null> {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!data) return null;

  // Atomic view count via RPC (SECURITY DEFINER)
  await supabase.rpc('increment_event_view_count', { p_event_id: id });

  return data as Event;
}

function getStaffSearchKeyword(event: Event) {
  if (event.type === 'event') return '박람회 스태프';
  if (event.type === 'news') return '채용행사';
  return event.title.split(/\s+/).slice(0, 2).join(' ') || '웨딩';
}

async function getRelatedJobs(event: Event): Promise<Job[]> {
  const supabase = createServerQueryClient();
  const keyword = event.type === 'event' ? '박람회' : event.type === 'news' ? '채용' : '웨딩';
  const { data } = await supabase
    .from('jobs')
    .select('*, author:profiles!author_id(*)')
    .is('deleted_at', null)
    .eq('hidden_by_admin', false)
    .eq('posting_type', 'hiring')
    .ilike('title', `%${keyword}%`)
    .order('is_promoted', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(4);

  return (data ?? []) as Job[];
}

function getTypeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type;
}

export default async function EventDetailPage({ params }: PageProps) {
  const event = await getEvent(params.id);
  if (!event) notFound();
  const relatedJobs = await getRelatedJobs(event);
  const staffKeyword = getStaffSearchKeyword(event);

  const imageUrl = event.image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${event.image}`
    : null;

  return (
    <div className="max-w-[920px] mx-auto space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/events" className="text-gray-500 hover:text-primary transition-colors">웨딩 행사·박람회</Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium">{getTypeLabel(event.type)}</span>
      </nav>

      {/* Article */}
      <article className="bg-white border border-gray-200 rounded overflow-hidden">
        {imageUrl && (
          <img src={imageUrl} alt={event.title} className="w-full max-h-[480px] object-cover" />
        )}

        <div className="p-6 md:p-8">
          {/* Tags */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-1 bg-primary-50 text-primary text-xs font-semibold">
              {getTypeLabel(event.type)}
            </span>
            {event.is_pinned && (
              <span className="inline-flex items-center px-2.5 py-1 bg-state-urgent-bg text-state-urgent text-xs font-bold">고정</span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-3">{event.title}</h1>

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-gray-400 pb-6 border-b border-gray-200 mb-6">
            <time>{formatRelativeTime(event.created_at)}</time>
            <span>·</span>
            <span>조회 {event.view_count.toLocaleString()}</span>
          </div>

          {/* Event Info */}
          {(event.start_date || event.location || event.link_url) && (
            <div className="bg-secondary-50 rounded p-4 mb-6 space-y-2">
              {event.start_date && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span className="text-gray-500">기간</span>
                  <span className="font-medium text-gray-800">
                    {formatDate(event.start_date)}
                    {event.end_date && ` ~ ${formatDate(event.end_date)}`}
                  </span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="text-gray-500">장소</span>
                  <span className="font-medium text-gray-800">{event.location}</span>
                </div>
              )}
              {event.link_url && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  <span className="text-gray-500">링크</span>
                  <a href={event.link_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline truncate">
                    {event.link_url}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <RichTextView html={event.content} className="text-[15px] text-gray-700 leading-relaxed min-h-[200px]" />

          <section className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-gray-400">채용 연결</p>
                <h2 className="mt-1 text-base font-bold text-ink">이 행사와 관련된 인력을 찾고 있나요?</h2>
                <p className="mt-1 text-sm text-gray-500">
                  부스 운영, 상담 플래너, 드레스·메이크업 보조처럼 행사 기간에 필요한 채용공고로 바로 연결할 수 있습니다.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href={`${ROUTES.JOBS}?search=${encodeURIComponent(staffKeyword)}`} className="btn-outline px-4 py-2 text-xs">
                  관련 공고 보기
                </Link>
                <Link href={ROUTES.JOBS_NEW} className="btn-primary px-4 py-2 text-xs">
                  공고 등록
                </Link>
              </div>
            </div>

            {relatedJobs.length > 0 && (
              <div className="mt-4 grid gap-2">
                {relatedJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={ROUTES.JOBS_DETAIL(job.id)}
                    className="rounded border border-gray-200 bg-white px-3 py-3 transition-colors hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900">{job.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {job.author?.company_name || job.author?.contact_name || '업체'} · {getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-primary">{job.salary_info || '조건 협의'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-secondary-50">
          <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
            </svg>
            목록으로
          </Link>
          <span className="text-xs text-gray-400">조회 {event.view_count.toLocaleString()}</span>
        </div>
      </article>
    </div>
  );
}
