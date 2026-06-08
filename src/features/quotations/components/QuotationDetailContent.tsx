'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { quotationService } from '../services/quotation-service';
import type { Quotation, QuotationStatus } from '@/types/database';
import { CONTRACT_STATUS_LABELS } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import QuotationStatusBadge from './QuotationStatusBadge';
import QuotationItemsTable from './QuotationItemsTable';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { notify } from '@/features/notifications/lib/dispatch';

export default function QuotationDetailContent({ quotationId, profileId }: { quotationId: string; profileId: string }) {
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<QuotationStatus | 'createContract' | 'delete' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await quotationService.getById(quotationId);
      if (!data) {
        setError('견적을 찾을 수 없습니다.');
        return;
      }
      setQuotation(data);
      // 받은 견적이고 'sent' 상태면 자동 viewed 처리
      await quotationService.markViewedIfNeeded(data, profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '견적을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [quotationId, profileId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
        <div className="h-60 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm text-rose-700 mb-3">{error ?? '견적을 찾을 수 없습니다.'}</p>
        <Link href={ROUTES.QUOTATIONS} className="btn-outline text-sm">목록으로</Link>
      </div>
    );
  }

  const isSender = quotation.sender_profile_id === profileId;
  const isReceiver = quotation.receiver_profile_id === profileId;
  const counterparty = isSender ? quotation.receiver : quotation.sender;
  const counterpartyName = counterparty?.company_name || counterparty?.contact_name || '상대방';

  const canSend = isSender && quotation.status === 'draft';
  const canCancel = isSender && ['draft', 'sent', 'viewed'].includes(quotation.status);
  const canAccept = isReceiver && ['sent', 'viewed'].includes(quotation.status);
  const canReject = isReceiver && ['sent', 'viewed'].includes(quotation.status);
  const canCreateContract = quotation.status === 'accepted';
  const canEdit = isSender && quotation.status === 'draft';
  const canDelete = isSender && quotation.status === 'draft';

  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  const handleTransition = async (next: QuotationStatus, reason?: string) => {
    setActing(next);
    try {
      const updated = await quotationService.transitionStatus(quotation.id, next, reason);
      setQuotation((prev) => prev ? { ...prev, ...updated } : prev);
      // 알림 디스패치 (fire-and-forget) — 메일 발송 실패가 거래 흐름을 막지 않음
      if (next === 'sent') notify.quotationSent(quotation.id);
      else if (next === 'accepted') notify.quotationAccepted(quotation.id);
      else if (next === 'rejected') notify.quotationRejected(quotation.id);
      toast(
        next === 'sent' ? '견적을 발송했습니다.'
        : next === 'accepted' ? '견적을 승인했습니다. 이제 계약으로 전환할 수 있습니다.'
        : next === 'rejected' ? '견적을 거절했습니다.'
        : next === 'cancelled' ? '견적을 취소했습니다.'
        : '상태를 변경했습니다.',
        'success'
      );
      setShowRejectInput(false);
      setRejectionReason('');
    } catch (err) {
      toast(err instanceof Error ? err.message : '상태 변경 실패', 'error');
    } finally {
      setActing(null);
    }
  };

  const handleCreateContract = async () => {
    if (!quotation.event_date) {
      toast('견적의 예식 날짜가 없어 계약 생성을 위해 날짜를 별도 입력해야 합니다. (TODO: 입력 모달)', 'error');
      return;
    }
    const ok = await toastConfirm(`견적 '${quotation.title}'을(를) 계약으로 전환합니다. 계속하시겠습니까?`);
    if (!ok) return;
    setActing('createContract');
    try {
      const { contract_id } = await quotationService.createContract(quotation.id, quotation.event_date);
      toast('계약을 생성했습니다.', 'success');
      router.push(ROUTES.CONTRACTS_DETAIL(contract_id));
    } catch (err) {
      toast(err instanceof Error ? err.message : '계약 생성 실패', 'error');
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async () => {
    const ok = await toastConfirm('이 견적 초안을 삭제할까요? 발송 전이라 복구할 수 없습니다.');
    if (!ok) return;
    setActing('delete');
    try {
      await quotationService.softDelete(quotation.id);
      toast('견적을 삭제했습니다.', 'success');
      router.push(ROUTES.QUOTATIONS);
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제 실패', 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 브레드크럼 */}
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.QUOTATIONS} className="hover:text-ink">견적</Link>
        <span className="mx-2">›</span>
        <span className="text-ink font-medium">{quotation.title}</span>
      </nav>

      {/* Hero */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <QuotationStatusBadge status={quotation.status} />
              <span className="text-xs text-gray-400">
                {isSender ? '내가 발송' : '내가 수신'} · {counterpartyName}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">{quotation.title}</h1>
            {quotation.description && (
              <p className="text-sm text-gray-600 leading-relaxed mt-2 whitespace-pre-wrap">{quotation.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">총액</p>
            <p className="text-2xl font-extrabold text-primary tabular-nums">{fmt(quotation.total_amount)} {quotation.currency}</p>
          </div>
        </div>

        {/* 메타 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
          <Meta label="예식 일자" value={quotation.event_date ?? '-'} />
          <Meta label="예식 장소" value={quotation.event_venue ?? '-'} />
          <Meta label="유효 기한" value={quotation.valid_until ?? '-'} />
          <Meta label="발송 시각" value={quotation.sent_at ? new Date(quotation.sent_at).toLocaleString('ko-KR') : '미발송'} />
        </div>
      </div>

      {/* 항목 표 */}
      <section>
        <h2 className="text-sm font-bold text-ink mb-2.5">견적 항목</h2>
        <QuotationItemsTable
          items={quotation.items ?? []}
          subtotal={quotation.subtotal}
          tax={quotation.tax}
          total={quotation.total_amount}
          currency={quotation.currency}
        />
      </section>

      {/* 거절 사유 (있을 때) */}
      {quotation.rejection_reason && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-bold uppercase text-rose-600 mb-1">거절 사유</p>
          <p className="text-sm text-rose-900 whitespace-pre-wrap">{quotation.rejection_reason}</p>
        </div>
      )}

      {/* 내부 메모 (발신자만) */}
      {isSender && quotation.internal_note && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">내부 메모 (상대방에게 보이지 않음)</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{quotation.internal_note}</p>
        </div>
      )}

      {/* 액션 패널 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sticky bottom-4 shadow-md">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">액션</p>
        <div className="flex flex-wrap gap-2">
          {/* PDF 다운로드 — draft 외 상태에서 노출 */}
          {quotation.status !== 'draft' && (
            <a
              href={`/api/pdf/quotation/${quotation.id}`}
              target="_blank"
              rel="noopener"
              className="btn-outline text-sm inline-flex items-center gap-1.5"
              title="견적서 PDF 다운로드"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" /></svg>
              PDF
            </a>
          )}
          {canEdit && (
            <Link href={ROUTES.QUOTATIONS_EDIT(quotation.id)} className="btn-outline text-sm">수정</Link>
          )}
          {canSend && (
            <button type="button" onClick={() => handleTransition('sent')} disabled={acting !== null} className="btn-primary text-sm">
              {acting === 'sent' ? '발송 중...' : '발송'}
            </button>
          )}
          {canAccept && (
            <button type="button" onClick={() => handleTransition('accepted')} disabled={acting !== null} className="btn-primary text-sm">
              {acting === 'accepted' ? '처리 중...' : '승인'}
            </button>
          )}
          {canReject && (
            !showRejectInput ? (
              <button type="button" onClick={() => setShowRejectInput(true)} disabled={acting !== null} className="btn-outline text-sm border-rose-300 text-rose-700 hover:border-rose-500">
                거절
              </button>
            ) : (
              <div className="w-full mt-2 space-y-2">
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="거절 사유 (선택)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 resize-none"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleTransition('rejected', rejectionReason)} disabled={acting !== null} className="btn-primary text-sm bg-rose-600 hover:bg-rose-700">
                    {acting === 'rejected' ? '처리 중...' : '거절 확정'}
                  </button>
                  <button type="button" onClick={() => { setShowRejectInput(false); setRejectionReason(''); }} className="btn-outline text-sm">취소</button>
                </div>
              </div>
            )
          )}
          {canCancel && (
            <button type="button" onClick={() => handleTransition('cancelled')} disabled={acting !== null} className="btn-outline text-sm">
              {acting === 'cancelled' ? '처리 중...' : '취소'}
            </button>
          )}
          {canCreateContract && (
            <button type="button" onClick={handleCreateContract} disabled={acting !== null} className="btn-primary text-sm">
              {acting === 'createContract' ? '생성 중...' : `${CONTRACT_STATUS_LABELS.awaiting_signatures} 상태로 계약 생성`}
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={handleDelete} disabled={acting !== null} className="ml-auto text-sm font-semibold text-gray-400 hover:text-rose-600">
              초안 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm text-ink mt-0.5">{value}</p>
    </div>
  );
}
