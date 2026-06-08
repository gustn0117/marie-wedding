'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { contractService } from '../services/contract-service';
import type { Contract } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import ContractStatusBadge from './ContractStatusBadge';
import QuotationItemsTable from '@/features/quotations/components/QuotationItemsTable';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { notify } from '@/features/notifications/lib/dispatch';
import DealProgress from '@/features/dashboard/components/DealProgress';
import { createClient } from '@/lib/supabase/client';

export default function ContractDetailContent({ contractId, profileId }: { contractId: string; profileId: string }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [dealProgress, setDealProgress] = useState<{ hasBooking: boolean; hasSettlement: boolean; settlementPaid: boolean }>({
    hasBooking: false, hasSettlement: false, settlementPaid: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contractService.getById(contractId);
      if (!data) { setError('계약을 찾을 수 없습니다.'); return; }
      setContract(data);

      // DealProgress 위한 booking + settlement 존재 여부 조회
      const supabase = createClient();
      const [bRes, sRes] = await Promise.all([
        supabase.from('bookings').select('id').eq('contract_id', contractId).is('deleted_at', null).limit(1),
        supabase.from('settlements').select('id, status').eq('contract_id', contractId).is('deleted_at', null).limit(1),
      ]);
      setDealProgress({
        hasBooking: (bRes.data?.length ?? 0) > 0,
        hasSettlement: (sRes.data?.length ?? 0) > 0,
        settlementPaid: (sRes.data?.[0]?.status === 'paid'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '계약을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-60 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center max-w-md mx-auto">
        <p className="text-sm text-rose-700 mb-3">{error ?? '계약을 찾을 수 없습니다.'}</p>
        <Link href={ROUTES.CONTRACTS} className="btn-outline text-sm">목록으로</Link>
      </div>
    );
  }

  const isPartyA = contract.party_a_profile_id === profileId;
  const isPartyB = contract.party_b_profile_id === profileId;
  const mySide: 'party_a' | 'party_b' | null = isPartyA ? 'party_a' : isPartyB ? 'party_b' : null;

  const partyASigned = contract.signatures?.some((s) => s.signer_side === 'party_a') ?? false;
  const partyBSigned = contract.signatures?.some((s) => s.signer_side === 'party_b') ?? false;
  const mySigned = (mySide === 'party_a' && partyASigned) || (mySide === 'party_b' && partyBSigned);

  const canSign = mySide !== null && !mySigned && ['draft', 'awaiting_signatures'].includes(contract.status);
  const canCancel = mySide !== null && !['completed', 'cancelled'].includes(contract.status);
  const canMarkInProgress = mySide !== null && contract.status === 'signed';
  const canComplete = mySide !== null && ['signed', 'in_progress'].includes(contract.status);
  const canCreateBooking = mySide !== null && ['signed', 'in_progress'].includes(contract.status);

  const quotation = contract.quotation;
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  const act = async (fn: () => Promise<Contract>, key: string, successMsg: string) => {
    setActing(key);
    try {
      const updated = await fn();
      setContract((prev) => (prev ? { ...prev, ...updated, signatures: prev.signatures } : updated));
      // 서명·취소 등은 signatures join이 빠진 RPC 결과만 옴 → 다시 로드
      await load();
      // 알림 — 서명 시 양방 서명 완료 여부로 분기
      if (key === 'sign') {
        const updatedSignaturesCount = (updated.signatures?.length ?? 0) || ((contract?.signatures?.length ?? 0) + 1);
        if (updatedSignaturesCount >= 2 || updated.status === 'signed') {
          notify.contractSigned(contract!.id);
        }
      }
      toast(successMsg, 'success');
      setShowCancelInput(false);
      setCancelReason('');
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리 실패', 'error');
    } finally {
      setActing(null);
    }
  };

  const handleCreateBooking = async () => {
    const ok = await toastConfirm('이 계약을 캘린더에 예약으로 등록합니다. 공급자(을)의 일정을 점유합니다. 계속하시겠습니까?');
    if (!ok) return;
    setActing('createBooking');
    try {
      await contractService.createBooking(contract.id, { providerSide: 'party_b' });
      toast('예약이 등록되었습니다. 캘린더에서 확인하세요.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '예약 등록 실패', 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.CONTRACTS} className="hover:text-ink">계약</Link>
        <span className="mx-2">›</span>
        <span className="text-ink font-medium">{contract.title}</span>
      </nav>

      {/* 거래 진행 시각화 */}
      <DealProgress
        quotationStatus="accepted"
        contractStatus={contract.status}
        hasBooking={dealProgress.hasBooking}
        hasSettlement={dealProgress.hasSettlement}
        settlementPaid={dealProgress.settlementPaid}
      />

      {/* Hero */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <ContractStatusBadge status={contract.status} />
              <span className="text-xs text-gray-400">
                갑 {contract.party_a_org_name} · 을 {contract.party_b_org_name}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">{contract.title}</h1>
            {contract.description && (
              <p className="text-sm text-gray-600 leading-relaxed mt-2 whitespace-pre-wrap">{contract.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">계약 금액</p>
            <p className="text-2xl font-extrabold text-primary tabular-nums">
              {fmt(contract.total_amount)} {contract.currency}
            </p>
          </div>
        </div>

        {/* 메타 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
          <Meta label="예식 일자" value={contract.event_date} />
          <Meta label="예식 장소" value={contract.event_venue ?? '-'} />
          <Meta label="체결 시각" value={contract.signed_at ? new Date(contract.signed_at).toLocaleString('ko-KR') : '서명 대기'} />
          <Meta label="완료 시각" value={contract.completed_at ? new Date(contract.completed_at).toLocaleString('ko-KR') : '-'} />
        </div>
      </div>

      {/* 서명 패널 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-bold text-ink mb-3">양방 서명</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SignatureSlot
            label="갑 (요청자)"
            orgName={contract.party_a_org_name}
            signed={partyASigned}
            signedAt={contract.signatures?.find((s) => s.signer_side === 'party_a')?.signed_at ?? null}
            isMe={isPartyA}
          />
          <SignatureSlot
            label="을 (공급자)"
            orgName={contract.party_b_org_name}
            signed={partyBSigned}
            signedAt={contract.signatures?.find((s) => s.signer_side === 'party_b')?.signed_at ?? null}
            isMe={isPartyB}
          />
        </div>
      </section>

      {/* 견적 항목 */}
      {quotation && quotation.items && quotation.items.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-ink mb-2.5">계약 항목 (견적 스냅샷)</h2>
          <QuotationItemsTable
            items={quotation.items}
            subtotal={quotation.subtotal}
            tax={quotation.tax}
            total={quotation.total_amount}
            currency={quotation.currency}
          />
        </section>
      )}

      {/* 결제·취소 조항 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {contract.payment_terms && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-bold uppercase text-gray-500 mb-1">결제 조건</p>
            <p className="text-sm text-ink whitespace-pre-wrap">{contract.payment_terms}</p>
          </div>
        )}
        {contract.cancellation_terms && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-bold uppercase text-gray-500 mb-1">취소 정책</p>
            <p className="text-sm text-ink whitespace-pre-wrap">{contract.cancellation_terms}</p>
          </div>
        )}
      </div>

      {/* 취소·분쟁 사유 */}
      {contract.cancellation_reason && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-bold uppercase text-rose-600 mb-1">
            {contract.status === 'disputed' ? '분쟁 사유' : '취소 사유'}
          </p>
          <p className="text-sm text-rose-900 whitespace-pre-wrap">{contract.cancellation_reason}</p>
        </div>
      )}

      {/* 액션 패널 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sticky bottom-4 shadow-md">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">액션</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/pdf/contract/${contract.id}`}
            target="_blank"
            rel="noopener"
            className="btn-outline text-sm inline-flex items-center gap-1.5"
            title="계약서 PDF 다운로드"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" /></svg>
            PDF
          </a>
          {canSign && (
            <button
              type="button"
              onClick={() => act(() => contractService.sign(contract.id), 'sign',
                partyASigned || partyBSigned ? '서명 완료. 양방 서명 완료로 계약이 체결되었습니다.' : '서명 완료. 상대방 서명을 기다립니다.'
              )}
              disabled={acting !== null}
              className="btn-primary text-sm"
            >
              {acting === 'sign' ? '서명 중...' : '서명하기'}
            </button>
          )}
          {canMarkInProgress && (
            <button
              type="button"
              onClick={() => act(() => contractService.markInProgress(contract.id), 'progress', '진행 중 상태로 전환했습니다.')}
              disabled={acting !== null}
              className="btn-outline text-sm"
            >
              {acting === 'progress' ? '...' : '진행 시작'}
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              onClick={async () => {
                const ok = await toastConfirm('계약을 완료로 처리합니다. 정산 단계로 진행할 수 있습니다. 계속하시겠습니까?');
                if (!ok) return;
                act(() => contractService.complete(contract.id), 'complete', '계약을 완료 처리했습니다.');
              }}
              disabled={acting !== null}
              className="btn-primary text-sm"
            >
              {acting === 'complete' ? '...' : '완료 처리'}
            </button>
          )}
          {canCreateBooking && (
            <button
              type="button"
              onClick={handleCreateBooking}
              disabled={acting !== null}
              className="btn-outline text-sm"
            >
              {acting === 'createBooking' ? '...' : '캘린더에 예약 등록'}
            </button>
          )}
          {canCancel && (
            !showCancelInput ? (
              <button
                type="button"
                onClick={() => setShowCancelInput(true)}
                disabled={acting !== null}
                className="btn-outline text-sm border-rose-300 text-rose-700 hover:border-rose-500"
              >
                {['signed', 'in_progress'].includes(contract.status) ? '분쟁 신청' : '계약 취소'}
              </button>
            ) : (
              <div className="w-full mt-2 space-y-2">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={['signed', 'in_progress'].includes(contract.status) ? '분쟁 사유를 적어주세요' : '취소 사유 (선택)'}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(() => contractService.cancel(contract.id, cancelReason), 'cancel',
                      ['signed', 'in_progress'].includes(contract.status) ? '분쟁 처리 요청됨' : '계약을 취소했습니다.'
                    )}
                    disabled={acting !== null}
                    className="btn-primary text-sm bg-rose-600 hover:bg-rose-700"
                  >
                    {acting === 'cancel' ? '처리 중...' : '확정'}
                  </button>
                  <button type="button" onClick={() => { setShowCancelInput(false); setCancelReason(''); }} className="btn-outline text-sm">취소</button>
                </div>
              </div>
            )
          )}
        </div>

        {/* 다음 단계 안내 */}
        {contract.status === 'signed' && (
          <p className="mt-3 text-xs text-gray-500">
            🎉 양방 서명 완료. <strong>&apos;진행 시작&apos;</strong>으로 예식 당일까지 진행 상태로 표시하거나, <strong>&apos;캘린더에 예약 등록&apos;</strong>으로 공급자 일정을 점유하세요.
          </p>
        )}
        {contract.status === 'completed' && (
          <p className="mt-3 text-xs text-gray-500">
            ✅ 계약 완료. <strong>정산</strong> 단계는 <Link href={ROUTES.SETTLEMENTS} className="text-primary font-semibold hover:underline">정산 페이지</Link>에서 (Milestone 1.5 예정)
          </p>
        )}
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

function SignatureSlot({
  label,
  orgName,
  signed,
  signedAt,
  isMe,
}: {
  label: string;
  orgName: string;
  signed: boolean;
  signedAt: string | null;
  isMe: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${signed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'} ${isMe ? 'ring-2 ring-primary-100' : ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
        {label} {isMe && <span className="text-primary">(나)</span>}
      </p>
      <p className="text-sm font-bold text-ink truncate">{orgName}</p>
      {signed ? (
        <p className="text-xs text-emerald-700 mt-1">
          ✓ 서명 완료 · {signedAt ? new Date(signedAt).toLocaleString('ko-KR') : ''}
        </p>
      ) : (
        <p className="text-xs text-gray-500 mt-1">서명 대기</p>
      )}
    </div>
  );
}
