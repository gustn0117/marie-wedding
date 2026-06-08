'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { quotationService } from '../services/quotation-service';
import type { Quotation, QuotationStatus } from '@/types/database';
import { QUOTATION_STATUS_LABELS } from '@/types/database';
import type { QuotationDirection } from '../types';
import QuotationCard from './QuotationCard';
import EmptyState from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  ...Object.entries(QUOTATION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function QuotationsListContent({
  profileId,
  initialDirection,
  initialStatus,
}: {
  profileId: string;
  initialDirection: QuotationDirection;
  initialStatus?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [direction, setDirection] = useState<QuotationDirection>(initialDirection);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus ?? '');
  const [list, setList] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await quotationService.list(profileId, {
        direction,
        status: statusFilter ? (statusFilter as QuotationStatus) : undefined,
      });
      setList(result.data);
      setCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : '견적 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [profileId, direction, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateUrl = (next: { tab?: QuotationDirection; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.tab) params.set('tab', next.tab);
    if (next.status !== undefined) {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div role="tablist" aria-label="견적 방향" className="flex gap-1 border-b border-gray-200">
        {(['received', 'sent'] as QuotationDirection[]).map((d) => {
          const isActive = direction === d;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { setDirection(d); updateUrl({ tab: d }); }}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                isActive ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {d === 'received' ? '받은 견적' : '보낸 견적'}
            </button>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">총 {count.toLocaleString()}건</span>
        <span className="text-gray-300">·</span>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); updateUrl({ status: e.target.value }); }}
          aria-label="상태 필터"
          className="px-2.5 h-7 rounded border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:border-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 리스트 */}
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
          title={direction === 'received' ? '받은 견적이 없습니다' : '보낸 견적이 없습니다'}
          description={direction === 'received'
            ? '거래 제안이 들어오면 여기에 표시됩니다. 디렉토리에서 협업할 업체를 먼저 찾아보세요.'
            : '거래하고 싶은 업체에게 첫 견적을 보내보세요.'}
          actionLabel={direction === 'received' ? '디렉토리 둘러보기' : '새 견적 작성'}
          actionHref={direction === 'received' ? ROUTES.DIRECTORY : ROUTES.QUOTATIONS_NEW}
        />
      ) : (
        <div className="space-y-3">
          {list.map((q) => (
            <QuotationCard key={q.id} quotation={q} perspective={direction} />
          ))}
        </div>
      )}

      {/* 보너스: 받은 견적 빈 상태에서 새 견적 작성 진입점도 보조로 */}
      {!loading && !error && list.length === 0 && direction === 'received' && (
        <p className="text-center text-xs text-gray-400">
          또는 <Link href={ROUTES.QUOTATIONS_NEW} className="text-primary font-semibold hover:underline">직접 견적을 보내보세요</Link>
        </p>
      )}
    </div>
  );
}
