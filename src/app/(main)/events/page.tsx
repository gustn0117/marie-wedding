import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { formatDate, formatRelativeTime } from '@/shared/utils/format';
import { EVENT_TYPES } from '@/features/events/types';
import Logo from '@/shared/components/Logo';
import type { Event } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '이벤트 & 소식 | Marié',
  description: 'Marié 이벤트 및 웨딩업계 소식을 확인하세요.',
};

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

async function getEvents(searchParams: Record<string, string | undefined>) {
  const supabase = createServerQueryClient();
  const type = searchParams.type;

  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .is('deleted_at', null);

  if (type) query = query.eq('type', type);

  query = query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, 49);

  const { data, count } = await query;
  return { events: (data ?? []) as Event[], count: count ?? 0 };
}

function getTypeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type;
}

function getTypeColor(type: string): string {
  if (type === 'event') return 'bg-primary text-white';
  if (type === 'news') return 'bg-blue-500 text-white';
  return 'bg-gray-700 text-white';
}

export default async function EventsPage({ searchParams }: PageProps) {
  const { events, count } = await getEvents(searchParams);
  const activeType = searchParams.type ?? '';

  // 상단 고정 이벤트와 일반 이벤트 분리
  const pinned = events.filter(e => e.is_pinned);
  const regular = events.filter(e => !e.is_pinned);

  return (
    <div className="space-y-4">
      <section className="platform-panel p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <p className="platform-eyebrow">News & Event</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight text-gray-950">이벤트 & 소식</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">
              Marié의 새로운 이벤트, 공지, 웨딩 업계 소식을 확인하세요.
            </p>
          </div>
          <div className="metric-tile">
            <span className="block text-[12px] font-bold text-gray-500">등록 소식</span>
            <span className="mt-1 block text-[20px] font-bold text-gray-950">{count.toLocaleString()}건</span>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="platform-panel flex overflow-x-auto">
        <Link
          href="/events"
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            !activeType ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          전체
        </Link>
        {EVENT_TYPES.map((t) => (
          <Link
            key={t.value}
            href={`/events?type=${t.value}`}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeType === t.value ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="platform-panel py-16 text-center">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
          <p className="text-gray-500">등록된 {activeType ? getTypeLabel(activeType) : '이벤트'}가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Events */}
          {pinned.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-small font-bold text-gray-700 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 9V4l1-1V1H7v2l1 1v5L6 11v2h5.2v7h1.6v-7H18v-2l-2-2z" />
                </svg>
                고정 공지
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {pinned.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Regular Events */}
          {regular.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {regular.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const imageUrl = event.image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${event.image}`
    : null;
  const preview = event.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <Link
      href={`/events/${event.id}`}
      className="platform-panel block transition-colors group hover:border-primary"
    >
      {imageUrl ? (
        <div className="aspect-[16/9] bg-gray-50 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={event.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-secondary-50 flex items-center justify-center">
          <Logo variant="mark" size="lg" className="text-primary/30" />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-1 mb-1.5">
          <span className={`badge ${getTypeColor(event.type)}`}>{getTypeLabel(event.type)}</span>
          {event.is_pinned && <span className="badge-urgent">고정</span>}
        </div>
        <h3 className="text-body-lg font-bold text-gray-900 group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-1.5">
          {event.title}
        </h3>
        {preview && (
          <p className="text-small text-gray-500 line-clamp-2 mb-2 leading-snug">{preview}</p>
        )}
        <div className="flex items-center gap-1.5 text-micro text-gray-400">
          <time>{formatRelativeTime(event.created_at)}</time>
          {event.start_date && (
            <>
              <span>·</span>
              <span>
                {formatDate(event.start_date)}
                {event.end_date ? ` ~ ${formatDate(event.end_date)}` : ''}
              </span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {event.view_count}
          </span>
        </div>
      </div>
    </Link>
  );
}
