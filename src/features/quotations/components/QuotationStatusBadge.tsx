import type { QuotationStatus } from '@/types/database';
import { QUOTATION_STATUS_LABELS } from '@/types/database';

const STATUS_TONES: Record<QuotationStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  viewed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function QuotationStatusBadge({ status, size = 'md' }: { status: QuotationStatus; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center rounded font-bold border ${STATUS_TONES[status]} ${sizing}`}
    >
      {QUOTATION_STATUS_LABELS[status]}
    </span>
  );
}
