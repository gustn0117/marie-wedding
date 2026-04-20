import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { createClient } from '@supabase/supabase-js';
import { formatDate, formatRelativeTime } from '@/shared/utils/format';
import { EVENT_TYPES } from '@/features/events/types';
import type { Event } from '@/types/database';
import RichTextView from '@/shared/components/RichTextView';

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

  // Increment view count (service role)
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'marie_wedding' } }
  );
  await svc.from('events').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);

  return data as Event;
}

function getTypeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type;
}

export default async function EventDetailPage({ params }: PageProps) {
  const event = await getEvent(params.id);
  if (!event) notFound();

  const imageUrl = event.image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${event.image}`
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/events" className="text-gray-500 hover:text-primary transition-colors">이벤트 &amp; 소식</Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium">{getTypeLabel(event.type)}</span>
      </nav>

      {/* Article */}
      <article className="bg-white border border-gray-200 overflow-hidden">
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
              <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-500 text-xs font-bold">고정</span>
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
            <div className="bg-gray-50 p-4 mb-6 space-y-2">
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
        </div>

        {/* Footer */}
        <div className="px-6 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
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
