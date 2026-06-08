import type { ContractStatus, QuotationStatus } from '@/types/database';

interface Step {
  key: 'quotation' | 'contract' | 'booking' | 'settlement';
  label: string;
  state: 'done' | 'current' | 'pending' | 'skipped';
}

export interface DealProgressProps {
  quotationStatus?: QuotationStatus | null;
  contractStatus?: ContractStatus | null;
  hasBooking?: boolean;
  hasSettlement?: boolean;
  settlementPaid?: boolean;
}

/**
 * 거래 전체 흐름 시각화 — 견적 → 계약 → 예약 → 정산.
 * 각 단계의 상태에 따라 done/current/pending/skipped로 표시.
 */
export default function DealProgress({
  quotationStatus,
  contractStatus,
  hasBooking,
  hasSettlement,
  settlementPaid,
}: DealProgressProps) {
  // 단계별 상태 계산
  const quotationDone = quotationStatus === 'accepted';
  const quotationCancelled = quotationStatus === 'rejected' || quotationStatus === 'cancelled' || quotationStatus === 'expired';

  const contractDone = contractStatus === 'signed' || contractStatus === 'in_progress' || contractStatus === 'completed';
  const contractCurrent = contractStatus === 'awaiting_signatures' || contractStatus === 'draft';
  const contractCancelled = contractStatus === 'cancelled' || contractStatus === 'disputed';

  const bookingDone = hasBooking === true;
  const settlementDone = !!settlementPaid;
  const settlementCurrent = hasSettlement === true && !settlementPaid;

  const steps: Step[] = [
    {
      key: 'quotation',
      label: '견적',
      state: quotationDone ? 'done' : quotationCancelled ? 'skipped' : quotationStatus ? 'current' : 'pending',
    },
    {
      key: 'contract',
      label: '계약',
      state: contractDone ? 'done' : contractCurrent ? 'current' : contractCancelled ? 'skipped' : 'pending',
    },
    {
      key: 'booking',
      label: '예약',
      state: bookingDone ? 'done' : contractDone ? 'current' : 'pending',
    },
    {
      key: 'settlement',
      label: '정산',
      state: settlementDone ? 'done' : settlementCurrent ? 'current' : 'pending',
    },
  ];

  return (
    <div className="surface p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">거래 진행</p>
      <ol className="flex items-center justify-between gap-1 relative">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <li key={step.key} className="flex-1 flex items-center min-w-0">
              <div className="flex flex-col items-center min-w-0 flex-1">
                <StepCircle state={step.state} index={idx + 1} />
                <p className={`mt-2 text-xs font-bold text-center truncate w-full ${
                  step.state === 'done' ? 'text-emerald-700'
                  : step.state === 'current' ? 'text-ink'
                  : step.state === 'skipped' ? 'text-rose-600'
                  : 'text-gray-400'
                }`}>
                  {step.label}
                </p>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mb-7 mx-1 min-w-[16px] ${
                  step.state === 'done' ? 'bg-emerald-500'
                  : step.state === 'skipped' ? 'bg-gray-300'
                  : 'bg-gray-200'
                }`} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepCircle({ state, index }: { state: Step['state']; index: number }) {
  const base = 'w-10 h-10 rounded-full inline-flex items-center justify-center text-sm font-bold shrink-0 border-2 transition-colors';
  if (state === 'done') {
    return (
      <span className={`${base} bg-emerald-500 border-emerald-500 text-white`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
      </span>
    );
  }
  if (state === 'current') {
    return <span className={`${base} bg-ink border-ink text-white ring-4 ring-ink/10`}>{index}</span>;
  }
  if (state === 'skipped') {
    return (
      <span className={`${base} bg-gray-100 border-gray-300 text-gray-400`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </span>
    );
  }
  return <span className={`${base} bg-white border-gray-300 text-gray-400`}>{index}</span>;
}
