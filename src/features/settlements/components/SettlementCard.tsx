import Link from 'next/link';
import type { Settlement } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import SettlementStatusBadge from './SettlementStatusBadge';

interface Props {
  settlement: Settlement;
  showPdfButton?: boolean;
}

export default function SettlementCard({ settlement, showPdfButton = true }: Props) {
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  const counterpartyName =
    settlement.contract?.party_a_profile_id === settlement.payee_profile_id
      ? settlement.contract?.party_b_org_name
      : settlement.contract?.party_a_org_name;

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-400 hover:shadow-sm transition-all group">
      {showPdfButton && settlement.status === 'paid' && (
        <a
          href={`/api/pdf/settlement/${settlement.id}`}
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-gray-600 bg-white border border-gray-200 hover:border-ink hover:text-ink"
          title="정산서 PDF 다운로드"
        >
          PDF
        </a>
      )}
      <Link
      href={ROUTES.CONTRACTS_DETAIL(settlement.contract_id)}
      className="block"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
            정산 · 상대 {counterpartyName ?? '미상'}
          </p>
          <h3 className="text-[15px] font-bold text-ink truncate group-hover:text-primary transition-colors">
            {settlement.contract?.title ?? '계약'}
          </h3>
        </div>
        <SettlementStatusBadge status={settlement.status} />
      </div>
      <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs text-gray-500">
            <span className="text-gray-400">총액</span>{' '}
            <span className="tabular-nums">{fmt(settlement.gross_amount)}</span>
            <span className="text-gray-400 mx-1">·</span>
            <span className="text-gray-400">수수료</span>{' '}
            <span className="tabular-nums">{fmt(settlement.platform_fee_amount)}</span>
          </p>
          {settlement.scheduled_at && settlement.status === 'approved' && (
            <p className="text-xs text-blue-600">
              <span className="text-gray-400">송금 예정</span> {new Date(settlement.scheduled_at).toLocaleDateString('ko-KR')}
            </p>
          )}
          {settlement.paid_at && (
            <p className="text-xs text-emerald-600">
              <span className="text-gray-400">송금 완료</span> {new Date(settlement.paid_at).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-gray-400">실수령</p>
          <p className="text-base font-bold text-ink tabular-nums">
            {fmt(settlement.net_amount)} <span className="text-xs font-bold text-gray-500">KRW</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(settlement.created_at)}</p>
        </div>
      </div>
      </Link>
    </div>
  );
}
