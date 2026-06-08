import Link from 'next/link';
import type { Contract } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import ContractStatusBadge from './ContractStatusBadge';

export default function ContractCard({ contract, profileId }: { contract: Contract; profileId: string }) {
  const isPartyA = contract.party_a_profile_id === profileId;
  const counterpartyName = isPartyA ? contract.party_b_org_name : contract.party_a_org_name;
  const myRole = isPartyA ? '갑(파티A)' : '을(파티B)';
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  // 서명 상태
  const sigCount = contract.signatures?.length ?? 0;
  const mySigned = contract.signatures?.some((s) => s.signer_profile_id === profileId) ?? false;

  return (
    <Link
      href={ROUTES.CONTRACTS_DETAIL(contract.id)}
      className="surface p-4 block hover:border-gray-400 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
            {myRole} · 상대 {counterpartyName}
          </p>
          <h3 className="text-[15px] font-bold text-ink truncate group-hover:text-primary transition-colors">
            {contract.title}
          </h3>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>
      <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs text-gray-500">
            <span className="text-gray-400">예식</span> {contract.event_date}
          </p>
          {contract.status === 'awaiting_signatures' && (
            <p className="text-xs">
              <span className="text-gray-400">서명</span>{' '}
              <span className={mySigned ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                {sigCount}/2
              </span>
              {!mySigned && <span className="text-gray-500 ml-1">— 내 서명 필요</span>}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-gray-400">금액</p>
          <p className="text-base font-bold text-ink tabular-nums">
            {fmt(contract.total_amount)} <span className="text-xs font-bold text-gray-500">{contract.currency}</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(contract.created_at)}</p>
        </div>
      </div>
    </Link>
  );
}
