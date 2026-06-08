import Link from 'next/link';
import type { Quotation } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import QuotationStatusBadge from './QuotationStatusBadge';

export default function QuotationCard({ quotation, perspective }: { quotation: Quotation; perspective: 'sent' | 'received' }) {
  const counterparty = perspective === 'sent' ? quotation.receiver : quotation.sender;
  const counterpartyName = counterparty?.company_name || counterparty?.contact_name || '상대방';
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  return (
    <Link
      href={ROUTES.QUOTATIONS_DETAIL(quotation.id)}
      className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-400 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
            {perspective === 'sent' ? '수신' : '발신'}: {counterpartyName}
          </p>
          <h3 className="text-[15px] font-bold text-ink truncate group-hover:text-primary transition-colors">
            {quotation.title}
          </h3>
        </div>
        <QuotationStatusBadge status={quotation.status} />
      </div>
      <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
        <div className="min-w-0">
          {quotation.event_date && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400">예식</span> {quotation.event_date}
            </p>
          )}
          {quotation.valid_until && quotation.status !== 'cancelled' && quotation.status !== 'expired' && (
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-gray-400">유효</span> {quotation.valid_until}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-gray-400">총액</p>
          <p className="text-base font-extrabold text-ink tabular-nums">
            {fmt(quotation.total_amount)} <span className="text-xs font-bold text-gray-500">{quotation.currency}</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(quotation.created_at)}</p>
        </div>
      </div>
    </Link>
  );
}
