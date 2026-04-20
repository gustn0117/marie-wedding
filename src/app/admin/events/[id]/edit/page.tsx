'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import EventForm from '@/features/events/components/EventForm';
import { eventService } from '@/features/events/services/event-service';
import { ROUTES } from '@/shared/constants';
import type { Event } from '@/types/database';

export default function AdminEventEditPage() {
  const params = useParams();
  const id = params.id as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventService.getEventById(id).then((data) => {
      setEvent(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <div className="text-center py-12 text-sm text-gray-500">로딩 중...</div>;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500 mb-4">이벤트를 찾을 수 없습니다.</p>
        <Link href={ROUTES.ADMIN_EVENTS} className="text-primary text-sm">목록으로</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.ADMIN_EVENTS} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">이벤트 수정</h1>
      </div>
      <div className="bg-white border border-gray-200 p-6 md:p-8">
        <EventForm
          eventId={event.id}
          initialData={{
            title: event.title,
            content: event.content,
            type: event.type,
            image: event.image,
            start_date: event.start_date?.split('T')[0] ?? '',
            end_date: event.end_date?.split('T')[0] ?? '',
            location: event.location ?? '',
            link_url: event.link_url ?? '',
            is_pinned: event.is_pinned,
          }}
        />
      </div>
    </div>
  );
}
