import type { ReactNode } from 'react';
import { Suspense } from 'react';
import EventsRail from '@/features/events/components/EventsRail';

export default function EventsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div className="h-10 mb-4" />}>
        <EventsRail />
      </Suspense>
      {children}
    </div>
  );
}
