import type { ReactNode } from 'react';
import { Suspense } from 'react';
import EventsRail from '@/features/events/components/EventsRail';

export default function EventsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
      <Suspense fallback={<div className="hidden lg:block" />}>
        <EventsRail />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
