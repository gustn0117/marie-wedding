'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { contractService } from '../services/contract-service';
import type { Contract, ContractStatus } from '@/types/database';
import { CONTRACT_STATUS_LABELS } from '@/types/database';
import ContractCard from './ContractCard';
import EmptyState from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  ...Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const SIDE_OPTIONS: { value: 'all' | 'party_a' | 'party_b'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'party_a', label: '내가 갑(요청)' },
  { value: 'party_b', label: '내가 을(공급)' },
];

export default function ContractsListContent({
  profileId,
  initialStatus,
  initialSide,
}: {
  profileId: string;
  initialStatus?: string;
  initialSide?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>(initialStatus ?? '');
  const [side, setSide] = useState<'all' | 'party_a' | 'party_b'>(
    (initialSide === 'party_a' || initialSide === 'party_b') ? initialSide : 'all'
  );
  const [list, setList] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await contractService.list(profileId, {
        side: side === 'all' ? 'all' : side,
        status: status ? (status as ContractStatus) : undefined,
      });
      setList(result.data);
      setCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : '계약 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [profileId, status, side]);

  useEffect(() => { load(); }, [load]);

  const updateUrl = (next: { status?: string; side?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }
    if (next.side !== undefined) {
      if (next.side !== 'all') params.set('side', next.side);
      else params.delete('side');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      {/* 사이드 탭 */}
      <div role="tablist" aria-label="내 역할" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {SIDE_OPTIONS.map((opt) => {
          const isActive = side === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { setSide(opt.value); updateUrl({ side: opt.value }); }}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                isActive ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">총 {count.toLocaleString()}건</span>
        <span className="text-gray-300">·</span>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); updateUrl({ status: e.target.value }); }}
          aria-label="상태 필터"
          className="px-2.5 h-7 rounded border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:border-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
        >
          {STATUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : list.length === 0 ? (
        <EmptyState
          title="아직 체결된 계약이 없습니다"
          description="견적이 승인되면 계약으로 전환할 수 있습니다. 먼저 견적부터 진행해 보세요."
          actionLabel="견적 보러가기"
          actionHref={ROUTES.QUOTATIONS}
        />
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <ContractCard key={c.id} contract={c} profileId={profileId} />
          ))}
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <p className="text-center text-xs text-gray-400">
          또는 <Link href={ROUTES.QUOTATIONS_NEW} className="text-primary font-semibold hover:underline">새 견적부터 작성</Link>
        </p>
      )}
    </div>
  );
}
