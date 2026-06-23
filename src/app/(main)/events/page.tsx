import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { formatDate, formatRelativeTime } from '@/shared/utils/format';
import { EVENT_TYPES } from '@/features/events/types';
import Logo from '@/shared/components/Logo';
import type { Event } from '@/types/database';
import PageHeader from '@/shared/components/PageHeader';
import EmptyState from '@/shared/components/EmptyState';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '웨딩 행사·박람회 | Marié',
  description: '웨딩박람회, 채용행사, 쇼케이스 일정을 확인하고 관련 스태프·상담 공고를 찾아보세요.',
};

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

async function getEvents(searchParams: Record<string, string | undefined>) {
  const supabase = createServerQueryClient();
  const type = searchParams.type;
  const q = normalizeSearchTerm(searchParams.q);
  const showPast = searchParams.past === '1';
  const todayIso = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .is('deleted_at', null);

  if (type) query = query.eq('type', type);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,location.ilike.%${q}%`);

  // 종료된 행사는 기본 숨김. ?past=1 로 명시 요청하면 함께 표시.
  // end_date 가 있으면 end_date >= 오늘, 없으면 start_date >= 오늘, 둘 다 없으면(상시) 노출.
  if (!showPast) {
    query = query.or(`end_date.gte.${todayIso},and(end_date.is.null,start_date.gte.${todayIso}),and(start_date.is.null,end_date.is.null)`);
  }

  query = query
    .order('is_pinned', { ascending: false })
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(0, 49);

  const { data, count } = await query;
  return { events: (data ?? []) as Event[], count: count ?? 0, showPast };
}

function getTypeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type;
}

function getTypeColor(type: string): string {
  if (type === 'event') return 'bg-primary text-white';
  if (type === 'news') return 'bg-ink text-white';
  return 'bg-gray-700 text-white';
}

function getEventStatus(event: Event): { label: string; tone: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = event.start_date ? new Date(event.start_date) : null;
  const end = event.end_date ? new Date(event.end_date) : start;
  start?.setHours(0, 0, 0, 0);
  end?.setHours(23, 59, 59, 999);
  if (start && start > today) return { label: '예정', tone: 'border-primary text-primary bg-primary-50' };
  if (end && end < today) return { label: '종료', tone: 'border-gray-300 text-gray-500 bg-white' };
  if (start || end) return { label: '진행 중', tone: 'border-ink text-ink bg-white' };
  return { label: '상시', tone: 'border-gray-300 text-gray-600 bg-white' };
}

function getStaffSearchKeyword(event: Event) {
  if (event.type === 'event') return '박람회 스태프';
  if (event.type === 'news') return '채용행사';
  return event.title.split(/\s+/).slice(0, 2).join(' ') || '웨딩';
}

export default async function EventsPage({ searchParams }: PageProps) {
  const { events, count, showPast } = await getEvents(searchParams);
  const activeType = searchParams.type ?? '';
  const q = searchParams.q ?? '';
  const pastQuery = (() => {
    const params = new URLSearchParams();
    if (activeType) params.set('type', activeType);
    if (q) params.set('q', q);
    if (!showPast) params.set('past', '1');
    const qs = params.toString();
    return qs ? `/events?${qs}` : '/events';
  })();

  // 상단 고정 이벤트와 일반 이벤트 분리
  const pinned = events.filter(e => e.is_pinned);
  const regular = events.filter(e => !e.is_pinned);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="웨딩 캘린더"
        title="웨딩 행사·박람회"
        description={`박람회, 채용행사, 쇼케이스 일정을 모아보고 관련 스태프·상담 공고로 이어집니다 · 등록 ${count.toLocaleString()}건`}
        actions={
          <>
            <Link href="/jobs?search=박람회 스태프" className="btn-outline text-sm">스태프 공고 보기</Link>
            <Link href="/jobs/new" className="btn-primary text-sm">행사 공고 등록</Link>
          </>
        }
      />

      <form action="/events" className="surface flex flex-col gap-2 p-3 sm:flex-row">
        {activeType && <input type="hidden" name="type" value={activeType} />}
        <label className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            name="q"
            defaultValue={q}
            placeholder="행사명, 장소, 지역 검색"
            className="input-field py-2.5 pl-9"
          />
        </label>
        <button className="btn-brand min-h-[44px] px-5 py-2.5 text-sm" type="submit">검색</button>
      </form>

      {/* Filter Tabs */}
      <div className="surface flex items-center overflow-x-auto">
        <Link
          href={q ? `/events?q=${encodeURIComponent(q)}` : '/events'}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            !activeType ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          전체
        </Link>
        {EVENT_TYPES.map((t) => (
          <Link
            key={t.value}
            href={`/events?type=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeType === t.value ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
        <Link
          href={pastQuery}
          className="ml-auto px-4 py-3 text-xs font-bold text-gray-500 hover:text-primary whitespace-nowrap"
        >
          {showPast ? '진행 중만 보기' : '지난 행사도 보기'}
        </Link>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <EmptyState
          title="조건에 맞는 웨딩 행사·박람회가 없습니다"
          description="다른 지역이나 행사명으로 다시 검색해 보세요."
          actionLabel="전체 일정 보기"
          actionHref="/events"
        />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pinned.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Regular Events */}
          {regular.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
  const status = getEventStatus(event);
  const staffKeyword = getStaffSearchKeyword(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className="platform-panel block overflow-hidden transition-colors group hover:border-primary"
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
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          <span className={`badge ${getTypeColor(event.type)}`}>{getTypeLabel(event.type)}</span>
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
          {event.is_pinned && <span className="badge-urgent">고정</span>}
        </div>
        <h3 className="text-body-lg font-bold text-gray-900 group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-1.5">
          {event.title}
        </h3>
        {preview && (
          <p className="text-small text-gray-500 line-clamp-2 mb-2 leading-snug">{preview}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-micro text-gray-400">
          {event.start_date ? (
            <span>
              {formatDate(event.start_date)}
              {event.end_date ? ` ~ ${formatDate(event.end_date)}` : ''}
            </span>
          ) : (
            <time>{formatRelativeTime(event.created_at)}</time>
          )}
          {event.location && (
            <>
              <span>·</span>
              <span className="truncate">{event.location}</span>
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
        <div className="mt-3 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors group-hover:border-primary group-hover:text-primary">
          관련 채용공고 보기 · {staffKeyword}
        </div>
      </div>
    </Link>
  );
}
