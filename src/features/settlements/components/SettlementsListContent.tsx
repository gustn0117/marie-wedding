'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { settlementService } from '../services/settlement-service';
import type { Settlement, SettlementStatus } from '@/types/database';
import { SETTLEMENT_STATUS_LABELS } from '@/types/database';
import SettlementCard from './SettlementCard';
import EmptyState from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants';

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.entries(SETTLEMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function SettlementsListContent({ profileId, initialStatus }: { profileId: string; initialStatus?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>(initialStatus ?? '');
  const [list, setList] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await settlementService.list({
        payeeId: profileId,
        status: status ? (status as SettlementStatus) : undefined,
      });
      setList(result.data);
      setCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [profileId, status]);

  useEffect(() => { load(); }, [load]);

  const updateUrl = (next: { status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // KPI 요약
  const summary = useMemo(() => {
    const total = list.reduce((s, x) => s + x.net_amount, 0);
    const paid = list.filter((x) => x.status === 'paid').reduce((s, x) => s + x.net_amount, 0);
    const pending = list.filter((x) => ['pending', 'approved', 'processing'].includes(x.status)).reduce((s, x) => s + x.net_amount, 0);
    return { total, paid, pending };
  }, [list]);

  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  return (
    <div className="space-y-4">
      {/* KPI 카드 */}
      {!loading && list.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="surface p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">전체 실수령</p>
            <p className="text-lg font-bold text-ink tabular-nums">{fmt(summary.total)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">KRW · {count}건</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">송금 완료</p>
            <p className="text-lg font-bold text-emerald-800 tabular-nums">{fmt(summary.paid)}</p>
            <p className="text-[10px] text-emerald-700 mt-0.5">KRW</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">진행 중</p>
            <p className="text-lg font-bold text-amber-800 tabular-nums">{fmt(summary.pending)}</p>
            <p className="text-[10px] text-amber-700 mt-0.5">KRW</p>
          </div>
        </div>
      )}

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
          title="정산 내역이 없습니다"
          description="계약이 완료되면 자동으로 정산이 생성됩니다. 먼저 계약을 완료해 보세요."
          actionLabel="계약 보러가기"
          actionHref={ROUTES.CONTRACTS}
        />
      ) : (
        <div className="space-y-3">
          {list.map((s) => (<SettlementCard key={s.id} settlement={s} />))}
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <p className="text-center text-xs text-gray-400">
          <Link href={ROUTES.QUOTATIONS_NEW} className="text-primary font-semibold hover:underline">새 견적부터 작성하기 →</Link>
        </p>
      )}
    </div>
  );
}
