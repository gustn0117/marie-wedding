'use client';

import Link from 'next/link';
import EventForm from '@/features/events/components/EventForm';
import { ROUTES } from '@/shared/constants';

export default function AdminEventNewPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.ADMIN_EVENTS} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">이벤트 등록</h1>
      </div>
      <div className="bg-white border border-gray-200 p-6 md:p-8">
        <EventForm />
      </div>
    </div>
  );
}
