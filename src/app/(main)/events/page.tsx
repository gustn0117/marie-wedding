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
  searchParams: Promise<Record<string, string | undefined>>;
}

type StatusFilter = 'all' | 'upcoming' | 'ongoing' | 'ended' | 'always';

async function getEvents(searchParams: Record<string, string | undefined>) {
  const supabase = createServerQueryClient();
  const type = searchParams.type;
  const q = normalizeSearchTerm(searchParams.q);
  const statusFilter: StatusFilter = (() => {
    const v = searchParams.status;
    if (v === 'upcoming' || v === 'ongoing' || v === 'ended' || v === 'always') return v;
    return 'all';
  })();
  const todayIso = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .is('deleted_at', null);

  if (type) query = query.eq('type', type);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,location.ilike.%${q}%`);

  // 상태별 필터 (QA-011)
  // - upcoming: start_date > 오늘
  // - ongoing:  start_date <= 오늘 AND (end_date >= 오늘 OR end_date is null)
  // - ended:    end_date < 오늘 (혹은 start_date < 오늘 AND end_date is null)
  // - always:   start_date is null AND end_date is null
  // - all:      기본은 종료된 것 제외 (upcoming + ongoing + always 합집합)
  switch (statusFilter) {
    case 'upcoming':
      query = query.gt('start_date', todayIso);
      break;
    case 'ongoing':
      query = query.lte('start_date', todayIso).or(`end_date.gte.${todayIso},end_date.is.null`);
      break;
    case 'ended':
      query = query.lt('end_date', todayIso);
      break;
    case 'always':
      query = query.is('start_date', null).is('end_date', null);
      break;
    default:
      query = query.or(`end_date.gte.${todayIso},and(end_date.is.null,start_date.gte.${todayIso}),and(start_date.is.null,end_date.is.null)`);
  }

  query = query
    .order('is_pinned', { ascending: false })
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(0, 49);

  const { data, count } = await query;
  return { events: (data ?? []) as Event[], count: count ?? 0, statusFilter };
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

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '진행 중·예정' },
  { value: 'upcoming', label: '진행 예정' },
  { value: 'ongoing', label: '진행 중' },
  { value: 'ended', label: '종료' },
];

function buildStatusHref(status: StatusFilter, type: string, q: string): string {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (type) params.set('type', type);
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `/events?${qs}` : '/events';
}

export default async function EventsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const { events, count, statusFilter } = await getEvents(resolvedSearchParams);
  const activeType = resolvedSearchParams.type ?? '';
  const q = resolvedSearchParams.q ?? '';

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

      {/* Status filter (QA-011) — 진행 상태별 4탭 */}
      <div className="surface flex items-center overflow-x-auto">
        {STATUS_TABS.map((s) => {
          const active = s.value === statusFilter;
          return (
            <Link
              key={s.value}
              href={buildStatusHref(s.value, activeType, q)}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                active ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Type sub-filter */}
      <div className="surface flex items-center overflow-x-auto">
        <Link
          href={buildStatusHref(statusFilter, '', q)}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            !activeType ? 'text-ink border-ink' : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          전체 종류
        </Link>
        {EVENT_TYPES.map((t) => (
          <Link
            key={t.value}
            href={buildStatusHref(statusFilter, t.value, q)}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeType === t.value ? 'text-ink border-ink' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
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
        </div>
        <div className="mt-3 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors group-hover:border-primary group-hover:text-primary">
          관련 채용공고 보기 · {staffKeyword}
        </div>
      </div>
    </Link>
  );
}
