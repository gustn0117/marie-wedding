import type { BookingStatus } from '@/types/database';
import { BOOKING_STATUS_LABELS } from '@/types/database';

const TONES: Record<BookingStatus, string> = {
  scheduled: 'bg-primary-50 text-primary border-primary-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  no_show: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function BookingStatusBadge({ status, size = 'md' }: { status: BookingStatus; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded font-bold border ${TONES[status]} ${sizing}`}>
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
