import type { Settlement } from '@/types/database';

export default function SettlementAmountBreakdown({ settlement, compact = false }: { settlement: Settlement; compact?: boolean }) {
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  const feePercent = (settlement.platform_fee_rate * 100).toFixed(1);

  if (compact) {
    return (
      <div className="text-right">
        <p className="text-[10px] text-gray-400">실수령</p>
        <p className="text-base font-bold text-primary tabular-nums">
          {fmt(settlement.net_amount)} <span className="text-xs font-bold text-gray-500">KRW</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">계약 총액 (gross)</span>
        <span className="font-semibold text-ink tabular-nums">{fmt(settlement.gross_amount)} KRW</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">플랫폼 수수료 ({feePercent}%)</span>
        <span className="font-semibold text-rose-600 tabular-nums">- {fmt(settlement.platform_fee_amount)} KRW</span>
      </div>
      {settlement.tax_withheld > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">원천세</span>
          <span className="font-semibold text-rose-600 tabular-nums">- {fmt(settlement.tax_withheld)} KRW</span>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200">
        <span className="text-sm font-bold text-ink">실수령 (net)</span>
        <span className="text-lg font-bold text-primary tabular-nums">{fmt(settlement.net_amount)} KRW</span>
      </div>
    </div>
  );
}
