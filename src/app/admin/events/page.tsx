'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { eventService } from '@/features/events/services/event-service';
import { EVENT_TYPES } from '@/features/events/types';
import { formatDate } from '@/shared/utils/format';
import { ROUTES } from '@/shared/constants';
import type { Event } from '@/types/database';

function getTypeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await eventService.getEvents({}, 1, 100);
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setDeleting(id);
    try {
      await eventService.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch {
      alert('삭제에 실패했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이벤트 & 소식 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {events.length}건</p>
        </div>
        <Link href={ROUTES.ADMIN_EVENTS_NEW} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          새로 등록
        </Link>
      </div>

      <div className="bg-white border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">로딩 중...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">등록된 이벤트가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">구분</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">제목</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">기간</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">고정</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">조회</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">등록일</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary text-xs font-semibold">
                        {getTypeLabel(event.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <Link href={`/events/${event.id}`} className="font-medium text-gray-900 hover:text-primary truncate block">
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {event.start_date ? (
                        <>
                          {formatDate(event.start_date)}
                          {event.end_date && ` ~ ${formatDate(event.end_date)}`}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {event.is_pinned && <span className="text-red-500 text-xs font-bold">★</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{event.view_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(event.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={ROUTES.ADMIN_EVENTS_EDIT(event.id)}
                          className="px-3 py-1 text-xs border border-gray-300 hover:bg-gray-50"
                        >
                          수정
                        </Link>
                        <button
                          onClick={() => handleDelete(event.id)}
                          disabled={deleting === event.id}
                          className="px-3 py-1 text-xs text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deleting === event.id ? '삭제 중' : '삭제'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
