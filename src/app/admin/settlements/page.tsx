'use client';

import { useCallback, useEffect, useState } from 'react';
import { settlementService } from '@/features/settlements/services/settlement-service';
import SettlementStatusBadge from '@/features/settlements/components/SettlementStatusBadge';
import SettlementAmountBreakdown from '@/features/settlements/components/SettlementAmountBreakdown';
import type { Settlement, SettlementStatus } from '@/types/database';
import { SETTLEMENT_STATUS_LABELS } from '@/types/database';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { useAuth } from '@/shared/hooks/useAuth';

const PIPELINE_STATUSES: SettlementStatus[] = ['pending', 'approved', 'processing', 'paid'];

export default function AdminSettlementsPage() {
  useAuth();
  const [list, setList] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | ''>('pending');
  const [acting, setActing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutReference, setPayoutReference] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await settlementService.list({ status: statusFilter || undefined }, 1, 50);
      setList(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  const act = async (id: string, fn: () => Promise<Settlement>, key: string, msg: string) => {
    setActing(`${id}:${key}`);
    try {
      const updated = await fn();
      setList((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
      if (selected?.id === id) setSelected({ ...selected, ...updated });
      toast(msg, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리 실패', 'error');
    } finally {
      setActing(null);
    }
  };

  const handleApprove = (s: Settlement) =>
    toastConfirm(`'${s.contract?.title ?? '정산'}' 송금을 승인합니다. 기본 송금 예정일은 3일 후로 설정됩니다.`)
      .then((ok) => { if (ok) act(s.id, () => settlementService.approve(s.id), 'approve', '승인되었습니다.'); });

  const handleProcess = async (s: Settlement) => {
    setSelected(s);
    setPayoutAccount('');
    setPayoutReference('');
  };

  const handleStartProcessing = async () => {
    if (!selected) return;
    await act(
      selected.id,
      () => settlementService.process(selected.id, { account: payoutAccount, reference: payoutReference }),
      'process',
      '처리 시작'
    );
    setSelected(null);
  };

  const handleMarkPaid = (s: Settlement) =>
    toastConfirm(`'${s.contract?.title}' 송금 완료 처리합니다. 실수령액 ${fmt(s.net_amount)} KRW.`)
      .then((ok) => { if (ok) act(s.id, () => settlementService.markPaid(s.id), 'paid', '송금 완료 처리되었습니다.'); });

  const handleFail = async (s: Settlement) => {
    const reason = window.prompt('실패 사유를 입력해 주세요:');
    if (!reason) return;
    await act(s.id, () => settlementService.fail(s.id, reason), 'fail', '실패 처리되었습니다.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">정산 관리</h1>
        <span className="text-sm text-gray-500">{list.length}건</span>
      </div>

      {/* 파이프라인 탭 */}
      <div role="tablist" aria-label="정산 상태" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        <TabButton active={statusFilter === ''} onClick={() => setStatusFilter('')} label="전체" />
        {PIPELINE_STATUSES.map((st) => (
          <TabButton key={st} active={statusFilter === st} onClick={() => setStatusFilter(st)} label={SETTLEMENT_STATUS_LABELS[st]} />
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-sm text-gray-500">
          해당 상태의 정산이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const isActing = (key: string) => acting === `${s.id}:${key}`;
            return (
              <article key={s.id} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="grid lg:grid-cols-[1fr_auto] gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SettlementStatusBadge status={s.status} />
                      <p className="text-xs text-gray-500">계약: <span className="font-semibold text-ink">{s.contract?.title ?? '미상'}</span></p>
                    </div>
                    <p className="text-sm text-gray-600">
                      <span className="text-gray-400">수령자</span> {s.payee?.company_name || s.payee?.contact_name || '미상'}
                      <span className="text-gray-300 mx-2">·</span>
                      <span className="text-gray-400">예식일</span> {s.contract?.event_date ?? '-'}
                    </p>
                    <SettlementAmountBreakdown settlement={s} />
                    {s.scheduled_at && (
                      <p className="text-xs text-blue-600">송금 예정: {new Date(s.scheduled_at).toLocaleString('ko-KR')}</p>
                    )}
                    {s.paid_at && (
                      <p className="text-xs text-emerald-600">송금 완료: {new Date(s.paid_at).toLocaleString('ko-KR')}</p>
                    )}
                    {s.failure_reason && (
                      <p className="text-xs text-rose-600">실패 사유: {s.failure_reason}</p>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    {s.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(s)}
                        disabled={acting !== null}
                        className="btn-primary text-sm"
                      >
                        {isActing('approve') ? '승인 중...' : '승인'}
                      </button>
                    )}
                    {s.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleProcess(s)}
                        disabled={acting !== null}
                        className="btn-primary text-sm"
                      >
                        송금 시작
                      </button>
                    )}
                    {(s.status === 'approved' || s.status === 'processing') && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(s)}
                          disabled={acting !== null}
                          className="btn-outline text-sm"
                        >
                          {isActing('paid') ? '...' : '완료 처리'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFail(s)}
                          disabled={acting !== null}
                          className="text-sm font-semibold text-gray-400 hover:text-rose-600"
                        >
                          실패 표시
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 송금 시작 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-bold text-ink">송금 시작</h2>
              <p className="mt-1 text-xs text-gray-500">
                {selected.contract?.title} · 실수령 {fmt(selected.net_amount)} KRW
              </p>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-600">송금 계좌 (마스킹)</label>
                <input
                  type="text"
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                  placeholder="예: 신한 110-***-***456"
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-600">참조번호 (선택)</label>
                <input
                  type="text"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                  placeholder="외부 결제 GW 참조"
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={() => setSelected(null)} className="btn-outline text-sm">취소</button>
              <button type="button" onClick={handleStartProcessing} disabled={acting !== null} className="btn-primary text-sm">
                {acting ? '처리 중...' : '처리 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors whitespace-nowrap ${
        active ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  );
}
