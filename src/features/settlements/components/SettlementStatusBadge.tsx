import type { SettlementStatus } from '@/types/database';
import { SETTLEMENT_STATUS_LABELS } from '@/types/database';

const TONES: Record<SettlementStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function SettlementStatusBadge({ status, size = 'md' }: { status: SettlementStatus; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded font-bold border ${TONES[status]} ${sizing}`}>
      {SETTLEMENT_STATUS_LABELS[status]}
    </span>
  );
}
