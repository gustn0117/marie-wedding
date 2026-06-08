'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { bookingService, type MonthBookingRow } from '../services/booking-service';
import { buildMonthCells, parseYm, shiftMonth, todayYmd, ymdRangeOfMonthGrid, formatKoreanDate, dDayLabel } from '../lib/calendar';
import BookingStatusBadge from './BookingStatusBadge';
import { ROUTES } from '@/shared/constants';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function BookingCalendarContent({ profileId }: { profileId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialYm = searchParams.get('ym') ?? undefined;
  const initialDate = searchParams.get('date');

  const [ym, setYm] = useState<string>(parseYm(initialYm).ym);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate ?? todayYmd());
  const [bookings, setBookings] = useState<MonthBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthInfo = useMemo(() => parseYm(ym), [ym]);
  const cells = useMemo(() => buildMonthCells(monthInfo.year, monthInfo.month), [monthInfo.year, monthInfo.month]);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('ym', ym);
    if (selectedDate) params.set('date', selectedDate);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [ym, selectedDate, router]);

  // 데이터 로드 — month grid 전체 범위 (이전월 잔여 + 다음월 잔여 포함)
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = ymdRangeOfMonthGrid(monthInfo.year, monthInfo.month);
      const rows = await bookingService.listByMonth(profileId, range.from, range.to);
      setBookings(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : '예약을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [profileId, monthInfo.year, monthInfo.month]);

  useEffect(() => { load(); }, [load]);

  // 날짜별 예약 인덱스
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, MonthBookingRow[]>();
    for (const b of bookings) {
      const list = map.get(b.event_date) ?? [];
      list.push(b);
      map.set(b.event_date, list);
    }
    return map;
  }, [bookings]);

  const selectedBookings = bookingsByDate.get(selectedDate) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* 캘린더 */}
      <section className="surface overflow-hidden">
        {/* 월 네비게이션 */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYm(shiftMonth(ym, -1))}
              aria-label="이전 달"
              className="w-8 h-8 inline-flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
            >
              ‹
            </button>
            <h2 className="text-base font-bold text-ink tabular-nums">{monthInfo.year}년 {monthInfo.month}월</h2>
            <button
              type="button"
              onClick={() => setYm(shiftMonth(ym, 1))}
              aria-label="다음 달"
              className="w-8 h-8 inline-flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const t = todayYmd(); setYm(t.slice(0, 7)); setSelectedDate(t); }}
              className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded hover:border-ink"
            >
              오늘
            </button>
            {loading && <span className="text-xs text-gray-400">로딩 중...</span>}
            {error && <span className="text-xs text-rose-600">{error}</span>}
          </div>
        </header>

        {/* 요일 헤더 */}
        <div role="row" className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAY_LABELS.map((w, i) => (
            <div
              key={w}
              role="columnheader"
              className={`px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider ${
                i === 0 ? 'text-rose-600' : i === 6 ? 'text-primary' : 'text-gray-500'
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 6주 grid — min-h 고정으로 레이아웃 시프트 방지 */}
        <div role="grid" aria-label={`${monthInfo.year}년 ${monthInfo.month}월`} className="grid grid-cols-7 grid-rows-6 min-h-[504px]">
          {cells.map((cell) => {
            const dayBookings = bookingsByDate.get(cell.ymd) ?? [];
            const isSelected = selectedDate === cell.ymd;
            return (
              <button
                key={cell.ymd}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-label={`${formatKoreanDate(cell.ymd)}, 예약 ${dayBookings.length}건`}
                onClick={() => setSelectedDate(cell.ymd)}
                className={`flex flex-col gap-0.5 p-1.5 border-r border-b border-gray-100 text-left transition-colors group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ink/20 ${
                  isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                } ${!cell.isCurrentMonth ? 'bg-gray-50/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      !cell.isCurrentMonth ? 'text-gray-300'
                      : cell.isToday ? 'inline-flex w-6 h-6 items-center justify-center rounded-full bg-ink text-white'
                      : cell.weekday === 0 ? 'text-rose-600'
                      : cell.weekday === 6 ? 'text-primary'
                      : 'text-ink'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {dayBookings.length > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold tabular-nums">
                      {dayBookings.length}
                    </span>
                  )}
                </div>
                {/* 셀 내 미니칩 */}
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                  {dayBookings.slice(0, 3).map((b) => (
                    <span
                      key={b.booking_id}
                      className={`text-[10px] leading-tight truncate px-1 py-0.5 rounded border-l-2 ${
                        b.status === 'completed' ? 'border-emerald-400 text-gray-500 line-through' :
                        b.status === 'cancelled' ? 'border-gray-300 text-gray-400 line-through' :
                        b.status === 'no_show' ? 'border-amber-500 text-amber-700' :
                        b.status === 'in_progress' ? 'border-blue-500 text-blue-700' :
                        'border-primary text-ink'
                      }`}
                      title={`${b.start_time?.slice(0, 5) ?? '종일'} ${b.counterpart_name}`}
                    >
                      {b.start_time ? `${b.start_time.slice(0, 5)} ` : ''}{b.counterpart_name}
                    </span>
                  ))}
                  {dayBookings.length > 3 && (
                    <span className="text-[10px] text-gray-500 font-semibold pl-1">+{dayBookings.length - 3}건</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 사이드 패널 */}
      <aside className="surface p-4 lg:sticky lg:top-20 lg:self-start max-h-[700px] overflow-y-auto">
        <header className="mb-4 pb-3 border-b border-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{dDayLabel(selectedDate)}</p>
          <h3 className="text-lg font-bold text-ink">{formatKoreanDate(selectedDate)}</h3>
        </header>

        {selectedBookings.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            <p className="mb-2">예약이 없습니다</p>
            <Link href={ROUTES.CONTRACTS} className="text-xs text-primary font-semibold hover:underline">
              계약 목록에서 예약 등록 →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {selectedBookings.map((b) => (
              <li key={b.booking_id} className="rounded-lg border border-gray-200 p-3 hover:border-gray-400 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Link href={ROUTES.CONTRACTS_DETAIL(b.contract_id)} className="text-sm font-bold text-ink hover:text-primary truncate">
                    {b.contract_title}
                  </Link>
                  <BookingStatusBadge status={b.status} size="sm" />
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  <span className="text-gray-400">상대</span> {b.counterpart_name}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {b.start_time || b.end_time ? (
                    <span className="tabular-nums font-semibold">
                      {b.start_time?.slice(0, 5) ?? ''}
                      {(b.start_time && b.end_time) ? ' - ' : ''}
                      {b.end_time?.slice(0, 5) ?? ''}
                    </span>
                  ) : (
                    <span className="text-gray-400">종일</span>
                  )}
                  {b.venue && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="truncate">{b.venue}</span>
                    </>
                  )}
                </div>
                {b.note && (
                  <p className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 whitespace-pre-wrap line-clamp-3">{b.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
