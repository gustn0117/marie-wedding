import type { ContractStatus } from '@/types/database';
import { CONTRACT_STATUS_LABELS } from '@/types/database';

const STATUS_TONES: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  awaiting_signatures: 'bg-amber-50 text-amber-700 border-amber-200',
  signed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-primary-50 text-primary border-primary-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  disputed: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function ContractStatusBadge({ status, size = 'md' }: { status: ContractStatus; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded font-bold border ${STATUS_TONES[status]} ${sizing}`}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}
